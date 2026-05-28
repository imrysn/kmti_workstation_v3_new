import { useState, useEffect, useMemo } from 'react';
import { materialsApi } from '../services/api';
import { SHAPE_MATERIALS_DEFAULTS, categorizeMaterial } from '../utils/materialParser';

export function useMaterialsDB(formShape: string) {
  const [dbMaterials, setDbMaterials] = useState<string[]>([]);

  useEffect(() => {
    materialsApi.list(undefined, 1000)
      .then(res => {
        if (res && Array.isArray(res.data)) {
          const names = res.data.map((m: any) => {
            if (!m.englishName) return null;
            const match = m.englishName.match(/\(([^)]+)\)/);
            return match ? match[1].trim() : m.englishName.trim();
          }).filter(Boolean);
          setDbMaterials(names);
        }
      })
      .catch(err => console.error('Failed to load material grades from DB:', err));
  }, []);

  const availableMaterials = useMemo(() => {
    const defaults = SHAPE_MATERIALS_DEFAULTS[formShape] || ['SS400'];
    const dynamic = dbMaterials.filter(name => categorizeMaterial(name, formShape));
    
    const combined = [...defaults];
    for (const name of dynamic) {
      if (!combined.includes(name)) {
        combined.push(name);
      }
    }
    return combined;
  }, [formShape, dbMaterials]);

  return { availableMaterials, dbMaterials };
}
