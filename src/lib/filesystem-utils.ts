import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Constants
const CUSTOMER_FOLDER_DIR = 'DOCUMENTS' as Directory;

// Sanitize customer name for folder creation
export const sanitizeCustomerName = (name: string): string => {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
};

// Create customer folder if it doesn't exist
export const ensureCustomerFolder = async (customerName: string): Promise<{ success: boolean; folderPath?: string; error?: string }> => {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Filesystem operations only available on mobile devices' };
  }

  try {
    const sanitizedName = sanitizeCustomerName(customerName);
    const folderPath = `${sanitizedName}`;

    // Try to read the directory to check if it exists
    try {
      await Filesystem.readdir({
        path: folderPath,
        directory: CUSTOMER_FOLDER_DIR
      });
      // If we reach here, folder exists
      return { success: true, folderPath };
    } catch (error) {
      // Folder doesn't exist, try to create it
      // Note: Capacitor Filesystem doesn't have a direct mkdir, but we can create a dummy file and delete it
      // Actually, let's try a different approach - create a .keep file to ensure directory exists
      try {
        await Filesystem.writeFile({
          path: `${folderPath}/.keep`,
          data: '',
          directory: CUSTOMER_FOLDER_DIR
        });
        // Directory was created successfully
        return { success: true, folderPath };
      } catch (createError) {
        console.error('Error creating customer folder:', createError);
        return { success: false, error: 'Failed to create customer folder' };
      }
    }
  } catch (error) {
    console.error('Error ensuring customer folder:', error);
    return { success: false, error: 'Failed to access filesystem' };
  }
};

// Save file to customer folder
export const saveFileToCustomerFolder = async (
  customerName: string,
  fileName: string,
  data: string
): Promise<{ success: boolean; uri?: string; folderPath?: string; error?: string }> => {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Filesystem operations only available on mobile devices' };
  }

  try {
    // Ensure customer folder exists
    const folderResult = await ensureCustomerFolder(customerName);
    if (!folderResult.success) {
      return { success: false, error: folderResult.error };
    }

    const sanitizedName = sanitizeCustomerName(customerName);
    const filePath = `${sanitizedName}/${fileName}`;

    // Save the file
    const result = await Filesystem.writeFile({
      path: filePath,
      data: data,
      directory: CUSTOMER_FOLDER_DIR
    });

    return { success: true, uri: result.uri, folderPath: sanitizedName };
  } catch (error: any) {
    console.error('Error saving file to customer folder:', error);
    return { success: false, error: `Failed to save file: ${error.message || error}` };
  }
};

// Get customer folder contents
export const getCustomerFolderContents = async (customerName: string): Promise<{ success: boolean; files?: any[]; error?: string }> => {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Filesystem operations only available on mobile devices' };
  }

  try {
    const sanitizedName = sanitizeCustomerName(customerName);
    const result = await Filesystem.readdir({
      path: sanitizedName,
      directory: CUSTOMER_FOLDER_DIR
    });

    return { success: true, files: result.files };
  } catch (error) {
    console.error('Error reading customer folder:', error);
    return { success: false, error: 'Failed to read customer folder' };
  }
};

// Delete file from customer folder
export const deleteFileFromCustomerFolder = async (
  customerName: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> => {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Filesystem operations only available on mobile devices' };
  }

  try {
    const sanitizedName = sanitizeCustomerName(customerName);
    const filePath = `${sanitizedName}/${fileName}`;

    await Filesystem.deleteFile({
      path: filePath,
      directory: CUSTOMER_FOLDER_DIR
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting file from customer folder:', error);
    return { success: false, error: 'Failed to delete file' };
  }
};
