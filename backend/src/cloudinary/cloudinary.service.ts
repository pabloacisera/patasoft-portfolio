import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    this.logger.log('Cloudinary configurado');
  }

  getClient() {
    return cloudinary;
  }

  async uploadImage(
    file: string | Buffer,
    folder: string,
    options: {
      publicId?: string;
      transformation?: any;
    } = {}
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder,
        resource_type: 'image',
        ...(options.publicId && { public_id: options.publicId }),
        ...(options.transformation && { transformation: options.transformation }),
      };

      if (typeof file === 'string') {
        cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
          if (error) {
            this.logger.error(`Error uploading: ${error.message}`);
            reject(error);
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        });
      } else {
        cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) {
            this.logger.error(`Error uploading: ${error.message}`);
            reject(error);
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }).end(file);
      }
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error) => {
        if (error) {
          this.logger.error(`Error deleting: ${error.message}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async createFolder(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.api.create_folder(path, (error) => {
        if (error && error.message !== 'Folder already exists') {
          this.logger.warn(`Folder warning: ${error.message}`);
        }
        resolve();
      });
    });
  }

  async listFolders(path: string = ''): Promise<string[]> {
    return new Promise((resolve, reject) => {
      cloudinary.api.sub_folders(path, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.folders.map((f: any) => f.name));
        }
      });
    });
  }

  getUrl(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...options,
    });
  }
}