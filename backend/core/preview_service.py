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
            else:
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
