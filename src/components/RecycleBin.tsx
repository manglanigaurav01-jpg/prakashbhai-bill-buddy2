import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, Clock, Package, FileText, DollarSign, ArrowLeft } from 'lucide-react';
import { getRecycleBin, restoreFromRecycleBin, permanentlyDelete, clearRecycleBin, getDaysRemaining, cleanupOldItems, RecycledItem } from '@/lib/recycle-bin';
import { useToast } from '@/hooks/use-toast';
import { SwipeableItem } from '@/components/SwipeableItem';

interface RecycleBinProps {
  onNavigate: (view: string) => void;
}

export const RecycleBin = ({ onNavigate }: RecycleBinProps) => {
  const [recycleBin, setRecycleBin] = useState<RecycledItem[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const loadRecycleBin = React.useCallback(() => {
    const cleaned = cleanupOldItems();
    if (cleaned > 0) {
      toast({
        title: 'Auto-cleanup',
        description: `${cleaned} item(s) older than 30 days were permanently deleted`,
      });
    }
    setRecycleBin(getRecycleBin());
  }, [toast]);

  useEffect(() => {
    loadRecycleBin();
  }, [loadRecycleBin]);

  const handleRestore = (itemId: string) => {
    const success = restoreFromRecycleBin(itemId);
    if (success) {
      toast({
        title: 'Item Restored',
        description: 'The item has been restored successfully',
      });
      loadRecycleBin();
    } else {
      toast({
        title: 'Restore Failed',
        description: 'Could not restore the item',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentDelete = (itemId: string) => {
    const success = permanentlyDelete(itemId);
    if (success) {
      toast({
        title: 'Permanently Deleted',
        description: 'The item has been permanently deleted',
      });
      loadRecycleBin();
      setConfirmDelete(null);
    }
  };

  const handleClearAll = () => {
    clearRecycleBin();
    toast({
      title: 'Recycle Bin Cleared',
      description: 'All items have been permanently deleted',
    });
    setRecycleBin([]);
    setConfirmClearAll(false);
  };

  const getIcon = (type: RecycledItem['type']) => {
    switch (type) {
      case 'customer':
        return <Package className="h-5 w-5" />;
      case 'bill':
        return <FileText className="h-5 w-5" />;
      case 'payment':
        return <DollarSign className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: RecycledItem['type']) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 md:p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-6 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('settings')}
              className="rounded-full hover:bg-primary/10 hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-x">
                Recycle Bin
              </h1>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Recover deleted items before permanent deletion
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="p-2 bg-destructive/10 rounded-xl">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm font-semibold bg-gradient-to-r from-destructive to-destructive bg-clip-text text-transparent">
              Recovery Center
            </span>
          </div>
        </div>

        <Card className="shadow-xl border-2 hover:shadow-2xl transition-all duration-300 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Deleted Items</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Items are kept for 30 days before permanent deletion
                  </CardDescription>
                </div>
              </div>
              {recycleBin.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmClearAll(true)}
                  className="hover:scale-105 transition-all duration-300"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recycleBin.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Recycle bin is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recycleBin.map((item) => {
                  const daysRemaining = getDaysRemaining(item.deletedAt);
                  return (
                    <SwipeableItem
                      key={item.id}
                      onEdit={() => {}}
                      onDelete={() => setConfirmDelete(item.id)}
                    >
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-muted-foreground">
                            {getIcon(item.type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{item.displayName}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                                {getTypeLabel(item.type)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(item.id)}
                            className="gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmDelete(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </SwipeableItem>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Recycle Bin?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {recycleBin.length} item(s) in the recycle bin. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this item. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)}
                className="bg-destructive text-destructive-foreground"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};