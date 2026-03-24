import struct
import os
import math
import io
from dataclasses import dataclass
from typing import List, Dict, Optional
from PIL import Image, ImageDraw, ImageFont

@dataclass
class Point3D:
    x: float
    y: float
    z: float

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
            
            if file_size < 10000000:
                self._extract_64bit_doubles(binary_data)
            
            if len(self.points) > 0:
                self._calculate_bounds()
                self._filter_points(10000)
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
                x, y, z = struct.unpack('<fff', binary_data[i:i+12])
                if self._is_valid_point(x, y, z):
                    self.points.append(Point3D(x, y, z))
            except Exception:
                continue
                
    def _extract_64bit_doubles(self, binary_data: bytes):
        for i in range(0, len(binary_data) - 24, 8):
            try:
                x, y, z = struct.unpack('<ddd', binary_data[i:i+24])
                if self._is_valid_point(x, y, z):
                    self.points.append(Point3D(x, y, z))
            except Exception:
                continue

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

    def _filter_points(self, max_points: int = 10000):
        if len(self.points) > max_points:
            step = len(self.points) // max_points
            self.points = self.points[::step][:max_points]
