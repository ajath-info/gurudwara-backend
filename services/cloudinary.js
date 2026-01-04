import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '../utils/dotenv.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

/**
 * Upload a single image file to Cloudinary
 * @param {Object} file - File object from express-fileupload
 * @param {String} folder - Folder path in Cloudinary (e.g., 'gurudwaras', 'rewards', 'avatars')
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<String>} - Public URL of the uploaded image
 */
export const uploadImageToCloudinary = async (file, folder = 'uploads', options = {}) => {
  try {
    // Convert file buffer to base64 data URI
    const base64Data = file.data.toString('base64');
    const dataURI = `data:${file.mimetype};base64,${base64Data}`;

    // Upload options
    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      format: file.mimetype.split('/')[1], // Extract format from mimetype
      ...options,
    };

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, uploadOptions);

    return result.secure_url; // Return the secure HTTPS URL
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file objects from express-fileupload
 * @param {String} folder - Folder path in Cloudinary
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<Array<String>>} - Array of public URLs
 */
export const uploadMultipleImagesToCloudinary = async (files, folder = 'uploads', options = {}) => {
  try {
    const uploadPromises = files.map(file => uploadImageToCloudinary(file, folder, options));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Cloudinary batch upload error:', error);
    throw error;
  }
};

/**
 * Delete an image from Cloudinary by URL
 * @param {String} imageUrl - Public URL of the image to delete
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
export const deleteImageFromCloudinary = async (imageUrl) => {
  try {
    // Extract public_id from URL
    // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL');
    }

    // Get the path after 'upload'
    const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
    // Remove file extension
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // Don't throw error for deletion failures - just log it
    return { result: 'error', error };
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<String>} imageUrls - Array of public URLs to delete
 * @returns {Promise<Array>} - Array of deletion results
 */
export const deleteMultipleImagesFromCloudinary = async (imageUrls) => {
  try {
    const deletePromises = imageUrls.map(url => deleteImageFromCloudinary(url));
    const results = await Promise.all(deletePromises);
    return results;
  } catch (error) {
    console.error('Cloudinary batch delete error:', error);
    return [];
  }
};



