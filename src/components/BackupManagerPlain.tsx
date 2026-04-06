import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createBackup, restoreBackup, BackupData, BackupPayload, parseBackupPayload, readBackupDataFile } from '@/lib/backup';
import { useToast } from '@/components/ui/use-toast';
import { Download, Upload, RefreshCw, FileText, FolderOpen } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export const BackupManagerPlain = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [previewPayload, setPreviewPayload] = useState<BackupPayload | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const handleSaveBackup = async () => {
    setIsLoading(true);
    try {
      const result = await createBackup({ mode: 'save' });
      if (result.success) {
        toast({
          title: 'Backup Saved',
          description: result.message
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'Failed to create backup'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareBackup = async () => {
    setIsLoading(true);
    try {
      const result = await createBackup({ mode: 'share' });
      if (result.success) {
        toast({
          title: 'Backup Shared',
          description: result.message
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Share Failed',
        description: error instanceof Error ? error.message : 'Failed to share backup'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadBackup = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
        const backupData = await readBackupDataFile(file);
        const payload = await parseBackupPayload(backupData);

        if (!payload.customers || !payload.bills || !payload.payments || !payload.lastBalances) {
          throw new Error('Invalid backup file structure');
        }

        setPreviewData(backupData);
        setPreviewPayload(payload);
        setShowPreview(true);
      } catch (error) {
        toast({
          title: 'Invalid File',
          description: error instanceof Error ? error.message : 'Failed to read backup file',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    input.click();
  };

  const handleConfirmRestore = async () => {
    if (!previewData || !previewPayload) {
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: 'No backup data available to restore'
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!previewPayload.customers || !previewPayload.bills || !previewPayload.payments || !previewPayload.lastBalances) {
        throw new Error('Backup data is corrupted or incomplete');
      }

      const jsonString = JSON.stringify(previewData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'backup.json', { type: 'application/json' });

      const result = await restoreBackup(file);
      if (result.success) {
        toast({
          title: 'Backup Restored',
          description: 'Your data has been successfully restored.'
        });
        setShowPreview(false);
        setPreviewData(null);
        setPreviewPayload(null);
        window.location.reload();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore backup'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Data Backup & Restore</CardTitle>
          <CardDescription>Create and restore complete plain JSON backups of your business data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-medium">Save Backup to Device</h3>
                <p className="text-sm text-muted-foreground">
                  Create portable plain JSON backups and save them directly to your device
                </p>
                {Capacitor.isNativePlatform() && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                    <div className="flex items-start gap-2">
                      <FolderOpen className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <p className="mb-1 font-semibold">Backup Location:</p>
                        <p>Backups are saved to <strong>Documents/</strong> folder on your device.</p>
                        <p className="mt-1">You can access them using any file manager app.</p>
                        <p className="mt-1">New backups are saved as normal JSON files without encryption.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={handleShareBackup}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isLoading ? 'Preparing...' : 'Share Backup'}
                </Button>

                <Button
                  onClick={handleSaveBackup}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Save Backup
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h4 className="mb-2 font-medium">Restore from Backup</h4>
                <p className="mb-4 text-sm text-muted-foreground">
                  Select a backup file (.json) to preview and restore your data
                </p>
                <Button variant="outline" onClick={handleUploadBackup} disabled={isLoading}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isLoading ? 'Processing...' : 'Upload Backup'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold">Backup Preview</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created</p>
                  <p className="text-sm">{new Date(previewData.createdAt).toLocaleString()}</p>
                </div>
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Version</p>
                  <p className="text-sm">{previewData.version}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded bg-blue-50 p-3 dark:bg-blue-950">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Customers</p>
                  <p className="text-lg font-semibold">{previewPayload?.customers.length || 0}</p>
                </div>
                <div className="rounded bg-green-50 p-3 dark:bg-green-950">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Bills</p>
                  <p className="text-lg font-semibold">{previewPayload?.bills.length || 0}</p>
                </div>
                <div className="rounded bg-purple-50 p-3 dark:bg-purple-950">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Payments</p>
                  <p className="text-lg font-semibold">{previewPayload?.payments.length || 0}</p>
                </div>
                <div className="rounded bg-orange-50 p-3 dark:bg-orange-950">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Balances</p>
                  <p className="text-lg font-semibold">{previewPayload?.lastBalances.length || 0}</p>
                </div>
                <div className="rounded bg-green-50 p-3 dark:bg-green-950">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Items</p>
                  <p className="text-lg font-semibold">{previewPayload?.items?.length || 0}</p>
                </div>
              </div>

              <div className="rounded bg-yellow-50 p-4 dark:bg-yellow-950">
                <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-400">Warning</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Restoring this backup will replace all current data. This action cannot be undone.
                  Consider creating a backup of your current data first.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewData(null);
                  setPreviewPayload(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmRestore}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  'Confirm Restore'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Alert>
        <AlertDescription>
          <strong>Backup includes:</strong> All customers, complete bill history (including edited bills),
          all payments with dates and methods, current balance information for all customers, all items from the item master,
          business analytics data, recycle bin data, and sync metadata.
        </AlertDescription>
      </Alert>
    </div>
  );
};
