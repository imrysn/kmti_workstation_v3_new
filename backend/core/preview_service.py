import os
import io
import asyncio
import hashlib
from fastapi import HTTPException
from fastapi.responses import Response, FileResponse
from core.thumbnail_helper import get_shell_thumbnail
from core.dwg_forensic import get_dwg_preview
from core.sw_forensic import get_sw_preview
from core.path_utils import globalize_path
from core.config import PREVIEW_CACHE_DIR

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

cad_extensions = {'.icd', '.sldprt', '.sldasm', '.slddrw', '.dwg', '.dxf', '.step', '.stp', '.iges', '.igs'}

# Fallback Placeholders
PLACEHOLDER_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'placeholders')
DEFAULT_PLACEHOLDER = os.path.join(PLACEHOLDER_DIR, 'cad_document.png')
MISSING_FILE_PLACEHOLDER = os.path.join(PLACEHOLDER_DIR, 'missing_file.png')
ENGINE_MISSING_PLACEHOLDER = os.path.join(PLACEHOLDER_DIR, 'engine_missing.png')


def render_icd_point_cloud_fallback(file_path: str, size: int = 512) -> bytes:
    """Generates a high-quality 3D point cloud isometric projection of the model geometry."""
    import math
    from PIL import Image, ImageDraw
    from core.icd_parser import SimpleICDParser

    parser = SimpleICDParser()
    if not parser.parse_file(file_path) or not parser.points:
        raise ValueError("Failed to parse ICD geometry points")

    # Filter out exact zero coordinates which are typically uninitialized binary blocks
    points = [p for p in parser.points if abs(p.x) > 1e-4 or abs(p.y) > 1e-4 or abs(p.z) > 1e-4]
    if not points:
        points = parser.points

    # Statistical outlier removal using distance-based IQR (Interquartile Range)
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    zs = [p.z for p in points]
    cx = sum(xs) / len(points)
    cy = sum(ys) / len(points)
    cz = sum(zs) / len(points)

    distances = []
    for p in points:
        d = math.sqrt((p.x - cx)**2 + (p.y - cy)**2 + (p.z - cz)**2)
        distances.append((d, p))

    sorted_d = sorted([item[0] for item in distances])
    n = len(sorted_d)
    q1 = sorted_d[int(n * 0.25)]
    q3 = sorted_d[int(n * 0.75)]
    iqr = q3 - q1
    max_d_limit = q3 + 2.0 * iqr

    filtered_points = [item[1] for item in distances if item[0] <= max_d_limit]

    min_x = min(p.x for p in filtered_points)
    max_x = max(p.x for p in filtered_points)
    min_y = min(p.y for p in filtered_points)
    max_y = max(p.y for p in filtered_points)
    min_z = min(p.z for p in filtered_points)
    max_z = max(p.z for p in filtered_points)

    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    cz = (min_z + max_z) / 2

    sz_x = max_x - min_x
    sz_y = max_y - min_y
    sz_z = max_z - min_z
    max_dim = max(sz_x, sz_y, sz_z)
    if max_dim == 0:
        max_dim = 1

    img = Image.new("RGBA", (size, size), (20, 24, 33, 255))
    draw = ImageDraw.Draw(img)

    scale = (size * 0.75) / max_dim

    # Isometric projection rotation
    theta = math.radians(20)
    phi = math.radians(40)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    cos_p, sin_p = math.cos(phi), math.sin(phi)

    scx, scy = size / 2, size / 2
    projected = []

    for p in filtered_points:
        dx = p.x - cx
        dy = p.y - cy
        dz = p.z - cz

        x1 = dx * cos_p - dz * sin_p
        z1 = dx * sin_p + dz * cos_p
        y2 = dy * cos_t - z1 * sin_t
        z2 = dy * sin_t + z1 * cos_t

        sx = scx + x1 * scale
        sy = scy - y2 * scale
        projected.append((z2, sx, sy))

    projected.sort(key=lambda item: item[0])

    for z_depth, sx, sy in projected:
        if 0 <= sx < size and 0 <= sy < size:
            depth_ratio = (z_depth + max_dim) / (2 * max_dim)
            depth_ratio = max(0.1, min(1.0, depth_ratio))

            r = int(0 + 120 * (1 - depth_ratio))
            g = int(200 + 55 * depth_ratio)
            b = int(220 + 35 * (1 - depth_ratio))

            draw.ellipse([sx - 2, sy - 2, sx + 2, sy + 2], fill=(r, g, b, int(255 * depth_ratio)))

    try:
        draw.text((15, size - 35), "iCAD 3D Point-Cloud Preview (Pure Python)", fill=(200, 200, 200, 120))
        if parser.part_name:
            draw.text((15, 15), f"PART: {parser.part_name}", fill=(0, 255, 255, 200))
    except Exception:
        pass

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

async def get_cached_preview(file_path: str, ext: str, full: bool = False) -> Response:
    """Gets preview from disk cache or generates and caches it professionally"""
    # 0. Globalize path first to resolve drive letters to UNC
    file_path = globalize_path(file_path)
    
    try:
        if not os.path.exists(file_path):
            print(f">>> [PREVIEW DIAG] File not found: {file_path}")
            if os.path.exists(MISSING_FILE_PLACEHOLDER):
                return FileResponse(MISSING_FILE_PLACEHOLDER)
            raise HTTPException(status_code=404, detail="File missing on disk")
            
        # 0.5 If FULL view is requested, we often want the raw file (especially for PDFs)
        cache_path = None
        if not full:
            file_stat = os.stat(file_path)
            cache_key = hashlib.md5(f"{file_path}_{file_stat.st_mtime}".encode('utf-8')).hexdigest()
            cache_path = os.path.join(PREVIEW_CACHE_DIR, f"{cache_key}.png")
            
            if os.path.exists(cache_path):
                def _read_cache():
                    with open(cache_path, 'rb') as f:
                        return f.read()
                cache_data = await asyncio.to_thread(_read_cache)
                return Response(content=cache_data, media_type="image/png")
    except Exception as e:
        # If cache fails, we proceed...
        cache_path = None
        print(f">>> [PREVIEW DIAG] Exception in cache check for {file_path}: {e}")

    def return_and_cache(content, media_type="image/png"):
        if not full and cache_path and content and media_type == "image/png":
            try:
                def _write_cache():
                    with open(cache_path, 'wb') as f:
                        f.write(content)
                _write_cache()
            except Exception: pass
        return Response(content=content, media_type=media_type)

    # 1. High Performance PDF Thumbnailing (Phase 2 Upgrade)
    if ext == '.pdf':
        if fitz and not full:
            # ONLY generate thumbnail if we are NOT in full mode
            try:
                def _get_pdf_thumb():
                    # This generates a 1st page snapshot, much faster and lighter for lists
                    doc = fitz.open(file_path)
                    if doc.page_count > 0:
                        page = doc.load_page(0)
                        pix = page.get_pixmap(dpi=150) # Standard preview DPI
                        img_bytes = pix.tobytes("png")
                        doc.close()
                        return img_bytes
                    doc.close()
                    return None
                
                pdf_thumb = await asyncio.to_thread(_get_pdf_thumb)
                if pdf_thumb:
                    return return_and_cache(pdf_thumb)
            except Exception as e:
                print(f">>> [PREVIEW DIAG] PDF Thumbnailing failed for {file_path}: {e}")
        
        # Fallback to direct PDF serving if thumbnailing fails or fitz missing
        try:
            def _read_file():
                with open(file_path, 'rb') as f:
                    return f.read()
            file_data = await asyncio.to_thread(_read_file)
            # Remove restrictive headers to fix Electron CSP blocks when webSecurity is already off
            return Response(content=file_data, media_type="application/pdf")
        except Exception: pass

    # 2. DWG Forensic (Specialized for CAD drafting reliability)
    if ext == '.dwg':
        try:
            dwg_data = await asyncio.to_thread(get_dwg_preview, file_path)
            if dwg_data:
                return return_and_cache(dwg_data)
        except Exception: pass

    # 3. SolidWorks Forensic (Fastest extraction from SW Streams)
    if ext in {'.sldprt', '.sldasm', '.slddrw'}:
        try:
            sw_data = await asyncio.to_thread(get_sw_preview, file_path)
            if sw_data:
                return return_and_cache(sw_data)
        except Exception: pass

    # 4. Universal Windows Shell Thumbnail (The new Multi-Tier Professional Engine)
    if ext in cad_extensions or ext in {'.rvt', '.ifc', '.3dm'}:
        try:
            def _get_thumb():
                # This now uses IExtractImage for Fujitsu iCAD SX stability
                img = get_shell_thumbnail(file_path, size=1024)
                if img:
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    return buf.getvalue()
                return None
            thumb_data = await asyncio.to_thread(_get_thumb)
            if thumb_data:
                return return_and_cache(thumb_data)
            
            # --- ICD FALLBACK POINT CLOUD RENDERING ---
            if ext == '.icd':
                print(f">>> [PREVIEW DIAG] Shell extension failed for .icd. Pivoting to pure-python 3D point cloud fallback for {file_path}")
                try:
                    fallback_data = await asyncio.to_thread(render_icd_point_cloud_fallback, file_path)
                    if fallback_data:
                        return return_and_cache(fallback_data)
                except Exception as fe:
                    print(f">>> [PREVIEW DIAG] Point cloud fallback failed: {fe}")

            print(f">>> [PREVIEW DIAG] Professional engine skipped for {ext}. No handlers available.")
            if os.path.exists(ENGINE_MISSING_PLACEHOLDER):
                return FileResponse(ENGINE_MISSING_PLACEHOLDER)
            return Response(content=b"", status_code=204)
        except Exception as e:
            print(f">>> [PREVIEW DIAG] Professional extraction failed for {file_path}: {e}")

    # 5. Standard Images (Direct Serving)
    preview_extensions = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    if ext in preview_extensions:
        try:
            def _read_img():
                with open(file_path, 'rb') as f:
                    return f.read()
            img_data = await asyncio.to_thread(_read_img)
            return Response(content=img_data, media_type=preview_extensions[ext])
        except Exception: pass
            
    # 6. PROFESSIONAL FALLBACK
    if os.path.exists(DEFAULT_PLACEHOLDER):
        return FileResponse(DEFAULT_PLACEHOLDER)
    
    return Response(content=b"", status_code=204)
