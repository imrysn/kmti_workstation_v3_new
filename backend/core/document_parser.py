import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

def parse_docx(file_path: str) -> str:
    """Parse text from DOCX files using python built-in zipfile and xml parsing."""
    try:
        with zipfile.ZipFile(file_path) as z:
            if 'word/document.xml' in z.namelist():
                xml_content = z.read('word/document.xml')
                root = ET.fromstring(xml_content)
                texts = []
                for elem in root.iter():
                    if elem.tag.endswith('t'):
                        if elem.text:
                            texts.append(elem.text)
                return " ".join(texts)
    except Exception:
        pass
    return ""

def parse_xlsx(file_path: str) -> str:
    """Parse text from XLSX spreadsheets using python built-in sharedStrings parsing."""
    try:
        with zipfile.ZipFile(file_path) as z:
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                texts = []
                for elem in root.iter():
                    if elem.tag.endswith('t'):
                        if elem.text:
                            texts.append(elem.text)
                return " ".join(texts)
    except Exception:
        pass
    return ""

def parse_dxf(file_path: str) -> str:
    """Parse text strings from AutoCAD DXF files directly."""
    try:
        texts = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            for i in range(len(lines) - 1):
                # In DXF group code '1' represents text value elements
                if lines[i].strip() == '1':
                    val = lines[i+1].strip()
                    # Skip code symbols/empty text
                    if val and len(val) > 1 and not val.startswith('\\'):
                        texts.append(val)
        return " ".join(texts)
    except Exception:
        pass
    return ""

def parse_pdf(file_path: str) -> str:
    """Parse text from PDF drawings and sheets using pypdf or PyPDF2 with fallback."""
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        texts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t)
        return " ".join(texts)
    except ImportError:
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(file_path)
            texts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texts.append(t)
            return " ".join(texts)
        except Exception:
            pass
    except Exception:
        pass
    return ""

def extract_document_content(file_path: str) -> str:
    """Detect file type and extract text content."""
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        return ""
        
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        return parse_pdf(file_path)
    elif ext == '.docx':
        return parse_docx(file_path)
    elif ext == '.xlsx':
        return parse_xlsx(file_path)
    elif ext == '.dxf':
        return parse_dxf(file_path)
        
    return ""
