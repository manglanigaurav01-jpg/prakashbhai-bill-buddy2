 import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createBackup, restoreBackup, BackupData } from '@/lib/backup';
import { useToast } from '@/components/ui/use-toast';
import { Download, Upload, RefreshCw, FileText } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export const BackupManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const handleCreateBackup = async () => {
    setIsLoading(true);
    try {
      const result = await createBackup(Capacitor.isNativePlatform());
      if (result.success) {
        toast({
          title: "Backup Created",
          description: result.message
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: error instanceof Error ? error.message : "Failed to create backup"
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
        // First, read and preview the backup
        const text = await file.text();
        const backupData: BackupData = JSON.parse(text);

        // Validate backup structure (support both old and new backup formats)
        if (!backupData.customers || !backupData.bills || !backupData.payments || !backupData.lastBalances) {
          throw new Error('Invalid backup file structure');
        }

        setPreviewData(backupData);
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
    if (!previewData) {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: "No backup data available to restore"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Validate backup data before proceeding
      if (!previewData.customers || !previewData.bills || !previewData.payments || !previewData.lastBalances) {
        throw new Error('Backup data is corrupted or incomplete');
      }

      // Create a temporary file for restoreBackup function
      const jsonString = JSON.stringify(previewData);
      if (jsonString === 'undefined') {
        throw new Error('Failed to serialize backup data');
      }

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
        // Reload the page to reflect restored data
        window.location.reload();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore backup"
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
          <CardDescription>Create and restore complete backups of your business data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium">Backup Operations</h3>
                <p className="text-sm text-muted-foreground">
                  Create comprehensive backups or restore from existing backup files
                </p>
                {Capacitor.isNativePlatform() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Backups are automatically shared. Save them to Downloads, Drive, or any accessible location.
                  </p>
                )}
              </div>
              <Button
                onClick={handleCreateBackup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Create Backup
              </Button>
            </div>

            <div className="border rounded-lg p-4">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">Upload Backup File</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a backup file (.json) to preview and restore your data
                </p>
                <Button variant="outline" onClick={handleUploadBackup} disabled={isLoading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isLoading ? 'Processing...' : 'Upload Backup'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Backup Preview</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm font-medium text-gray-600">Created</p>
                  <p className="text-sm">{new Date(previewData.createdAt).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm font-medium text-gray-600">Version</p>
                  <p className="text-sm">{previewData.version}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm font-medium text-blue-600">Customers</p>
                  <p className="text-lg font-semibold">{previewData.customers.length}</p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-sm font-medium text-green-600">Bills</p>
                  <p className="text-lg font-semibold">{previewData.bills.length}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <p className="text-sm font-medium text-purple-600">Payments</p>
                  <p className="text-lg font-semibold">{previewData.payments.length}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <p className="text-sm font-medium text-orange-600">Balances</p>
                  <p className="text-lg font-semibold">{previewData.lastBalances.length}</p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-sm font-medium text-green-600">Items</p>
                  <p className="text-lg font-semibold">{previewData.items?.length || 0}</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Warning</h4>
                <p className="text-sm text-yellow-700">
                  Restoring this backup will replace all current data. This action cannot be undone.
                  Consider creating a backup of your current data first.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewData(null);
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
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
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
