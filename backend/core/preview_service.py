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

cad_extensions = {'.icd', '.sldprt', '.sldasm', '.slddrw', '.dwg', '.dxf', '.step', '.stp', '.iges', '.igs'}

# Fallback Placeholders
DEFAULT_PLACEHOLDER = os.path.join(os.path.dirname(__file__), '..', 'static', 'placeholders', 'cad_document.png')

async def get_cached_preview(file_path: str, ext: str) -> Response:
    """Gets preview from disk cache or generates and caches it professionally"""
    # 0. Globalize path first to resolve drive letters to UNC
    file_path = globalize_path(file_path)
    
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File missing on disk")
            
        file_stat = os.stat(file_path)
        cache_key = hashlib.md5(f"{file_path}_{file_stat.st_mtime}".encode('utf-8')).hexdigest()
        cache_dir = os.path.join(os.path.dirname(__file__), '..', '.preview_cache')
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"{cache_key}.png")
        
        if os.path.exists(cache_path):
            def _read_cache():
                with open(cache_path, 'rb') as f:
                    return f.read()
            cache_data = await asyncio.to_thread(_read_cache)
            return Response(content=cache_data, media_type="image/png")
    except Exception as e:
        # If cache fails, we proceed to generation...
        cache_path = None

    def return_and_cache(content, media_type="image/png"):
        if cache_path and content and media_type == "image/png":
            try:
                def _write_cache():
                    with open(cache_path, 'wb') as f:
                        f.write(content)
                _write_cache()
            except Exception: pass
        return Response(content=content, media_type=media_type)

    # 1. Direct Media Serving: PDF 
    if ext == '.pdf':
        try:
            def _read_file():
                with open(file_path, 'rb') as f:
                    return f.read()
            file_data = await asyncio.to_thread(_read_file)
            headers = {
                "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; frame-ancestors *",
                "X-Frame-Options": "ALLOWALL"
            }
            return Response(content=file_data, media_type="application/pdf", headers=headers)
        except Exception:
            pass

    # 2. DWG Forensic (Specialized for CAD drafting reliability)
    if ext == '.dwg':
        try:
            dwg_data = await asyncio.to_thread(get_dwg_preview, file_path)
            if dwg_data:
                return return_and_cache(dwg_data)
        except Exception:
            pass

    # 3. SolidWorks Forensic (Fastest extraction from SW Streams)
    if ext in {'.sldprt', '.sldasm', '.slddrw'}:
        try:
            sw_data = await asyncio.to_thread(get_sw_preview, file_path)
            if sw_data:
                return return_and_cache(sw_data)
        except Exception:
            pass

    # 4. Universal Windows Shell Thumbnail (The new Multi-Tier Professional Engine)
    # This handles .icd (iCAD SX), .rvt, .ifc, etc.
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
        except Exception as e:
            print(f">>> [PREVIEW DIAG] Professional extraction failed for {file_path}: {e}")

    # 5. Standard Images (Direct Serving)
    preview_extensions = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    if ext in preview_extensions:
        try:
            def _read_img():
                with open(file_path, 'rb') as f:
                    return f.read()
            img_data = await asyncio.to_thread(_read_img)
            return Response(content=img_data, media_type=preview_extensions[ext])
        except Exception:
            pass
            
    # 6. PROFESSIONAL FALLBACK: Never throw a 500 error on preview generation.
    # We return a professional placeholder instead.
    if os.path.exists(DEFAULT_PLACEHOLDER):
        return FileResponse(DEFAULT_PLACEHOLDER)
    
    # Final absolute resort if placeholder is missing
    return Response(content=b"", status_code=204)
