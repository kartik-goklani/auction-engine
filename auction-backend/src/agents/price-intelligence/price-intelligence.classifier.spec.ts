import { classifyItem, type ItemClass } from './price-intelligence.classifier';

describe('classifyItem', () => {
  it('returns EXACT_CATALOG when both brand and model are provided', () => {
    const result = classifyItem({
      brandName: 'Apple',
      modelNumber: 'Mac mini M4',
      title: 'Mac mini',
      category: 'IT Hardware',
      unit: 'units',
    });
    expect(result).toBe('EXACT_CATALOG');
  });

  it('returns EXACT_CATALOG even if keySpecs and commodity unit are also present', () => {
    const result = classifyItem({
      brandName: 'HP',
      modelNumber: 'ProBook 450',
      keySpecs: '16GB RAM',
      title: 'HP Laptop',
      category: 'IT Hardware',
      unit: 'kg', // irrelevant — brand+model wins
    });
    expect(result).toBe('EXACT_CATALOG');
  });

  it('returns SPEC_DEFINED when keySpecs is provided but no model', () => {
    const result = classifyItem({
      keySpecs: '16GB RAM, 512GB SSD, i5',
      title: 'Business Laptop',
      category: 'IT Hardware',
      unit: 'units',
    });
    expect(result).toBe('SPEC_DEFINED');
  });

  it('returns SPEC_DEFINED when title contains spec indicators (RAM, SSD, etc.)', () => {
    const result = classifyItem({
      title: 'Office laptop with 8GB RAM and 256GB SSD',
      category: 'Electronics',
      unit: 'units',
    });
    expect(result).toBe('SPEC_DEFINED');
  });

  it('returns COMMODITY for kg unit with raw material category', () => {
    const result = classifyItem({
      title: 'HDPE Granules',
      category: 'Raw Materials',
      unit: 'kg',
    });
    expect(result).toBe('COMMODITY');
  });

  it('returns COMMODITY for litre unit', () => {
    const result = classifyItem({
      title: 'Industrial Lubricant',
      category: 'Chemicals',
      unit: 'litre',
    });
    expect(result).toBe('COMMODITY');
  });

  it('returns COMMODITY when category mentions raw material keywords', () => {
    const result = classifyItem({
      title: 'Steel Plates',
      category: 'Metal Products',
      unit: 'pieces',
    });
    expect(result).toBe('COMMODITY');
  });

  it('returns SERVICE for service category with hours unit', () => {
    const result = classifyItem({
      title: 'IT Support',
      category: 'IT Services',
      unit: 'hours',
    });
    expect(result).toBe('SERVICE');
  });

  it('returns SERVICE for consulting category', () => {
    const result = classifyItem({
      title: 'Management Consulting',
      category: 'Consulting Services',
      unit: 'days',
    });
    expect(result).toBe('SERVICE');
  });

  it('defaults to SPEC_DEFINED when only title and category with no indicators', () => {
    const result = classifyItem({
      title: 'Dell Laptop',
      category: 'IT Hardware',
      unit: 'units',
    });
    expect(result).toBe('SPEC_DEFINED');
  });

  it('handles empty/undefined optional fields gracefully', () => {
    const result = classifyItem({
      brandName: '',        // empty string — should not trigger EXACT_CATALOG
      modelNumber: undefined,
      title: 'Generic Product',
      category: 'General',
      unit: 'pieces',
    });
    expect(result).toBe('SPEC_DEFINED');
  });
});
