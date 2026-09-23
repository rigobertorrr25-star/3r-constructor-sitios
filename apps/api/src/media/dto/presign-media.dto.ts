import { IsIn } from 'class-validator';
import { MEDIA_TYPES } from '../media-storage.js';

export class PresignMediaDto {
  @IsIn(Object.keys(MEDIA_TYPES))
  contentType!: string;
}
