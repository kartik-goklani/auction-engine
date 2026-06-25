'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AuctionReportData } from './AuctionReportPDF';

interface Props {
  data: AuctionReportData;
  className?: string;
}

export function ExportReportButton({ data, className }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const [{ pdf }, { AuctionReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./AuctionReportPDF'),
      ]);

      const blob = await pdf(<AuctionReportPDF data={data} />).toBlob();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `auction-report-${data.auction.id.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ExportReportButton] PDF generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="md"
      loading={loading}
      onClick={handleExport}
      className={className}
    >
      <Download size={13} />
      {loading ? 'Generating PDF…' : 'Export Report'}
    </Button>
  );
}
