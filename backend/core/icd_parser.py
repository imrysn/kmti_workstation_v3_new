import struct
import math
import io
from pathlib import Path
from typing import List, Tuple, Dict, Optional
from PIL import Image, ImageDraw, ImageFont

class Point3D:
    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z

class SimpleICDParser:
    def __init__(self):
        self.points = []
        self.bounds = None
        self.part_name = ""
        
    def parse_file(self, file_path: str) -> bool:
        try:
            with open(file_path, 'rb') as f:
                # Read up to 5MB to avoid hanging on massive assemblies
                f.seek(0, 2)
                file_size = f.tell()
                
                if file_size > 5000000:
                    f.seek(0)
                    chunk1 = f.read(2500000)
                    f.seek(file_size - 2500000)
                    chunk2 = f.read(2500000)
                    binary_data = chunk1 + chunk2
                else:
                    f.seek(0)
                    binary_data = f.read()

            self._extract_part_name(binary_data)
            self._extract_32bit_floats(binary_data)
            
            # Skip expensive regex searches for very large files
            if file_size < 10000000:
                self._extract_64bit_doubles(binary_data)
                self._extract_text_coordinates(binary_data)
            
            if len(self.points) > 0:
                self._calculate_bounds()
                self._filter_points()
                return True
            return False
        except Exception:
            return False
            
    def _extract_part_name(self, binary_data: bytes):
        try:
            header = binary_data[:100]
            header_str = ''.join(chr(b) if 32 <= b <= 126 else ' ' for b in header)
            import re
            part_match = re.search(r'([A-Z0-9]{5,20})', header_str)
            if part_match:
                self.part_name = part_match.group(1).strip()
        except Exception:
            pass

    def _extract_32bit_floats(self, binary_data: bytes):
        for i in range(0, len(binary_data) - 12, 4):
            try:
                x = struct.unpack('<f', binary_data[i:i+4])[0]
                y = struct.unpack('<f', binary_data[i+4:i+8])[0]
                z = struct.unpack('<f', binary_data[i+8:i+12])[0]
                if self._is_valid_point(x, y, z):
                    self.points.append(Point3D(x, y, z))
            except Exception:
                continue
                
    def _extract_64bit_doubles(self, binary_data: bytes):
        for i in range(0, len(binary_data) - 24, 8):
            try:
                x = struct.unpack('<d', binary_data[i:i+8])[0]
                y = struct.unpack('<d', binary_data[i+8:i+16])[0]
                z = struct.unpack('<d', binary_data[i+16:i+24])[0]
                if self._is_valid_point(x, y, z):
                    self.points.append(Point3D(x, y, z))
            except Exception:
                continue

    def _extract_text_coordinates(self, binary_data: bytes):
        try:
            text_data = binary_data.decode('utf-8', errors='ignore')
            import re
            matches = re.findall(r'([-+]?\d*\.?\d*[eE][-+]?\d+)', text_data)
            coords = []
            for match in matches:
                try:
                    c = float(match)
                    if self._is_reasonable_coordinate(c):
                        coords.append(c)
                except ValueError:
                    continue
            for i in range(0, len(coords) - 2, 3):
                x, y, z = coords[i:i+3]
                if self._is_valid_point(x, y, z):
                    self.points.append(Point3D(x, y, z))
        except Exception:
            pass

    def _is_valid_point(self, x: float, y: float, z: float) -> bool:
        return all(self._is_reasonable_coordinate(c) and not math.isnan(c) and not math.isinf(c) for c in [x, y, z])
    
    def _is_reasonable_coordinate(self, coord: float) -> bool:
        return -10000 <= coord <= 10000

    def _calculate_bounds(self):
        if not self.points: return
        min_x = min(p.x for p in self.points)
        max_x = max(p.x for p in self.points)
        min_y = min(p.y for p in self.points)
        max_y = max(p.y for p in self.points)
        min_z = min(p.z for p in self.points)
        max_z = max(p.z for p in self.points)
        
        self.bounds = {
            'min': Point3D(min_x, min_y, min_z),
            'max': Point3D(max_x, max_y, max_z),
            'center': Point3D((min_x + max_x) / 2, (min_y + max_y) / 2, (min_z + max_z) / 2),
            'size': Point3D(max_x - min_x, max_y - min_y, max_z - min_z)
        }

    def _filter_points(self):
        if len(self.points) > 2000:
            step = len(self.points) // 2000
            self.points = self.points[::step][:2000]

class PointCloudRenderer:
    def __init__(self, width: int = 800, height: int = 600):
        self.width = width
        self.height = height
        
    def render(self, parser: SimpleICDParser) -> Optional[Image.Image]:
        if not parser.points or not parser.bounds: return None
        try:
            image = Image.new('RGB', (self.width, self.height), (248, 248, 248))
            draw = ImageDraw.Draw(image)
            
            b_size = parser.bounds['size']
            iso_width = b_size.x + b_size.z * 0.866
            iso_height = b_size.y + (b_size.x + b_size.z) * 0.5
            scale = min((self.width - 100) / max(iso_width, 1), (self.height - 100) / max(iso_height, 1)) * 0.7
            offset_x, offset_y = self.width // 2, self.height // 2
            
            for point in parser.points:
                iso_x = (point.x - point.z) * 0.866025
                iso_y = (point.x + point.z) * 0.5 - point.y
                screen_x = int(iso_x * scale + offset_x)
                screen_y = int(-iso_y * scale + offset_y)
                
                if 0 <= screen_x <= self.width and 0 <= screen_y <= self.height:
                    depth_factor = (point.z - parser.bounds['min'].z) / (b_size.z or 1)
                    radius = 1 + int(depth_factor * 2)
                    c = (min(255, 50 + int(depth_factor * 50)), min(255, 150 + int(depth_factor * 30)), 50)
                    draw.ellipse([screen_x - radius, screen_y - radius, screen_x + radius, screen_y + radius], fill=c)
                    
            try:
                font = ImageFont.load_default()
                draw.text((15, 18), f"ICD Point Cloud: {parser.part_name}", fill=(0, 0, 0), font=font)
                draw.text((self.width - 200, self.height - 40), f"Points: {len(parser.points)}", fill=(60, 60, 60), font=font)
                draw.text((self.width - 200, self.height - 20), f"Size: {b_size.x:.0f} x {b_size.y:.0f} x {b_size.z:.0f}", fill=(60, 60, 60), font=font)
            except: pass
            
            return image
        except: return None
