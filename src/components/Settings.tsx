import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, Moon, Sun, Trash2, User as UserIcon, Shield, Database, Cloud, Settings as SettingsIcon, Lock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { BackupManager } from "./BackupManager";
import { isPasswordSet, setPassword, verifyPassword, changePassword, removePassword } from '@/components/password';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from '@/lib/theme-manager';

import { Separator } from "@/components/ui/separator";
interface SettingsProps {
  onNavigate: (view: string) => void;
}
export const Settings = ({ onNavigate }: SettingsProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { effectiveTheme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const isDarkMode = effectiveTheme === 'dark';
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(isPasswordSet());
  const [passwordAction, setPasswordAction] = useState<'set' | 'change' | 'remove' | 'confirmClear'>('set');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const toggleDarkMode = () => {
    toggleTheme();
    toast({
      title: `${!isDarkMode ? 'Dark' : 'Light'} mode enabled`,
      description: `Switched to ${!isDarkMode ? 'dark' : 'light'} theme.`,
    });
  };
  const clearAllData = async () => {
    try {
      // Clear localStorage data but preserve theme
      const currentTheme = localStorage.getItem('theme');
      localStorage.clear();
      if (currentTheme) {
        localStorage.setItem('theme', currentTheme);
      }
      // Clear PDF files on mobile
      if (Capacitor.isNativePlatform()) {
        try {
          const files = await Filesystem.readdir({
            path: '',
            directory: 'DOCUMENTS' as Directory
          });
          // Delete all PDF files
          for (const file of files.files) {
            if (file.name.toLowerCase().endsWith('.pdf')) {
              await Filesystem.deleteFile({
                path: file.name,
                directory: 'DOCUMENTS' as Directory
              });
            }
          }
        } catch (error) {
          console.log('No files to clear or error accessing files:', error);
        }
      }
      toast({
        title: "Data Cleared",
        description: "All app data and PDFs have been successfully cleared.",
      });
      // Close dialog and navigate back
      setIsConfirmOpen(false);
      setShowPasswordDialog(false);
      setPasswordInput('');
      onNavigate('dashboard');
      // Refresh the page to reset the app state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Error",
        description: "Failed to clear some data. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleClearDataClick = () => {
    if (isPasswordSet()) {
      setPasswordAction('confirmClear');
      setShowPasswordDialog(true);
    } else {
      setIsConfirmOpen(true);
    }
  };
  const handlePasswordDialogSubmit = () => {
    switch (passwordAction) {
      case 'confirmClear':
        if (verifyPassword(passwordInput)) {
          clearAllData();
        } else {
          toast({ title: "Incorrect Password", description: "The password you entered is incorrect.", variant: "destructive" });
        }
        break;
      case 'set': {
        if (newPassword !== confirmNewPassword) {
          toast({ title: "Passwords don't match", variant: "destructive" });
          return;
        }
        const setResult = setPassword(newPassword);
        toast({ title: setResult.success ? "Password Set" : "Error", description: setResult.message, variant: setResult.success ? "default" : "destructive" });
        if (setResult.success) {
          setPasswordEnabled(true);
          setShowPasswordDialog(false);
          resetPasswordFields();
        }
        break;
      }
      case 'change': {
        if (newPassword !== confirmNewPassword) {
          toast({ title: "New passwords don't match", variant: "destructive" });
          return;
        }
        const changeResult = changePassword(currentPassword, newPassword);
        toast({ title: changeResult.success ? "Password Changed" : "Error", description: changeResult.message, variant: changeResult.success ? "default" : "destructive" });
        if (changeResult.success) {
          setShowPasswordDialog(false);
          resetPasswordFields();
        }
        break;
      }
      case 'remove': {
        const removeResult = removePassword(currentPassword);
        toast({ title: removeResult.success ? "Password Removed" : "Error", description: removeResult.message, variant: removeResult.success ? "default" : "destructive" });
        if (removeResult.success) {
          setPasswordEnabled(false);
          setShowPasswordDialog(false);
          resetPasswordFields();
        }
        break;
      }
    }
  };
  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordInput('');
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 md:p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Modern Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-6 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('dashboard')}
              className="rounded-full hover:bg-primary/10 hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-x">
                Settings
              </h1>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Manage your app preferences and data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="p-2 bg-primary/10 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Configuration Center
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Appearance Settings */}
            <Card className="shadow-xl border-2 hover:shadow-2xl transition-all duration-300 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                    {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-xl">Appearance</CardTitle>
                    <CardDescription>Customize your visual experience</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      Dark Mode
                      {isDarkMode && <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">Active</span>}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={toggleDarkMode}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardContent>
            </Card>
            {/* Security Settings */}
            <Card className="shadow-xl border-2 hover:shadow-2xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20 text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Security & Privacy</CardTitle>
                    <CardDescription>Protect your sensitive data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {passwordEnabled ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-green-500">Password Protection Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your data is protected with a 4-digit password
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => { setPasswordAction('change'); setShowPasswordDialog(true); }}
                        className="w-full"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => { setPasswordAction('remove'); setShowPasswordDialog(true); }}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-semibold text-yellow-500">No Password Set</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set a password to protect sensitive actions like clearing all data
                      </p>
                    </div>
                    <Button 
                      onClick={() => { setPasswordAction('set'); setShowPasswordDialog(true); }}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Set 4-Digit Password
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Enhanced Backup System */}
            <BackupManager />
          </div>
          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            {/* Data Management */}
            <Card className="shadow-xl border-2 hover:shadow-2xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-destructive/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20 text-destructive">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Data Management</CardTitle>
                    <CardDescription>Manage your app data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs text-muted-foreground mb-3">
                    This will permanently delete all customers, bills, payments, items, and PDF files. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleClearDataClick}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Recycle Bin Navigation */}
            <Card className="shadow-xl border-2 hover:shadow-2xl transition-all duration-300 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-foreground">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Recycle Bin</CardTitle>
                    <CardDescription>Recover deleted items</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted/50 mb-3">
                  <p className="text-xs text-muted-foreground">
                    Items are kept for 30 days before permanent deletion
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => onNavigate('recycleBin')}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Open Recycle Bin
                </Button>
              </CardContent>
            </Card>
            {/* Quick Info Card */}
            <Card className="shadow-xl border-2 bg-gradient-to-br from-primary/5 to-accent/5 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <SettingsIcon className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Quick Tips</span>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>• Enable dark mode for better viewing in low light</p>
                    <p>• Set a password to protect sensitive actions</p>
                    <p>• Sign in with Google for automatic backups</p>
                    <p>• Check recycle bin to recover deleted items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Confirmation Dialog */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Confirm Data Deletion
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to clear all data? This action will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All customers</li>
                  <li>All bills</li>
                  <li>All payments</li>
                  <li>All items</li>
                  <li>All PDF files stored on device</li>
                </ul>
                <strong className="text-destructive">This action cannot be undone.</strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={clearAllData}
                className="w-full sm:w-auto"
              >
                Yes, Clear All Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${passwordAction === 'confirmClear' || passwordAction === 'remove' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                  <Lock className="w-5 h-5" />
                </div>
                <DialogTitle className="text-xl">
                  {passwordAction === 'set' && 'Set New Password'}
                  {passwordAction === 'change' && 'Change Password'}
                  {passwordAction === 'remove' && 'Remove Password Protection'}
                  {passwordAction === 'confirmClear' && 'Confirm Data Deletion'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm">
                {passwordAction === 'set' && 'Create a 4-digit numeric password to protect sensitive actions.'}
                {passwordAction === 'change' && 'Enter your current password and choose a new one.'}
                {passwordAction === 'remove' && 'Enter your current password to remove protection.'}
                {passwordAction === 'confirmClear' && (
                  <span className="text-destructive font-semibold">This is a destructive action. All data will be permanently deleted.</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {(passwordAction === 'change' || passwordAction === 'remove') && (
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-sm font-semibold">Current Password</Label>
                  <Input 
                    id="current-password" 
                    type="password" 
                    inputMode="numeric" 
                    pattern="[0-9]*" 
                    maxLength={4} 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-center text-2xl tracking-widest font-mono"
                    placeholder="••••"
                  />
                </div>
              )}
              {(passwordAction === 'set' || passwordAction === 'change') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-semibold">New 4-Digit Password</Label>
                    <Input 
                      id="new-password" 
                      type="password" 
                      inputMode="numeric" 
                      pattern="[0-9]*" 
                      maxLength={4} 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-center text-2xl tracking-widest font-mono"
                      placeholder="••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password" className="text-sm font-semibold">Confirm New Password</Label>
                    <Input 
                      id="confirm-new-password" 
                      type="password" 
                      inputMode="numeric" 
                      pattern="[0-9]*" 
                      maxLength={4} 
                      value={confirmNewPassword} 
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="text-center text-2xl tracking-widest font-mono"
                      placeholder="••••"
                    />
                  </div>
                </>
              )}
              {passwordAction === 'confirmClear' && (
                <div className="space-y-2">
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                    <p className="text-sm text-destructive font-semibold mb-2">⚠️ Warning: This action cannot be undone</p>
                    <p className="text-xs text-muted-foreground">
                      All customers, bills, payments, items, and PDF files will be permanently deleted.
                    </p>
                  </div>
                  <Label htmlFor="password-input" className="text-sm font-semibold">Enter 4-Digit Password</Label>
                  <Input 
                    id="password-input" 
                    type="password" 
                    inputMode="numeric" 
                    pattern="[0-9]*" 
                    maxLength={4} 
                    value={passwordInput} 
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="text-center text-2xl tracking-widest font-mono"
                    placeholder="••••"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowPasswordDialog(false); resetPasswordFields(); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordDialogSubmit}
                variant={passwordAction === 'confirmClear' || passwordAction === 'remove' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {passwordAction === 'set' && 'Set Password'}
                {passwordAction === 'change' && 'Change Password'}
                {passwordAction === 'remove' && 'Remove Password'}
                {passwordAction === 'confirmClear' && 'Delete All Data'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
