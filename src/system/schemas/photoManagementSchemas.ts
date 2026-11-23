import { z } from 'zod';
import { photoAdjustmentsSchema } from './studioSchemas';

const id = z.string().min(1).max(64);
export const photoBatchMatchModeSchema = z.enum(['smart', 'sequence']);
export const photoBatchMatchSchema = z.object({
  classId: id,
  mode: photoBatchMatchModeSchema,
  pairs: z.array(z.object({ photoId: id, studentId: id }).strict()).min(1).max(20_000),
}).strict();

export const deleteStudioPhotosSchema = z.object({
  classId: id.optional(),
  photoIds: z.array(id).min(1).max(20_000),
}).strict().refine(({ photoIds }) => new Set(photoIds).size === photoIds.length, {
  message: 'Fotoğraf seçimi tekrar eden kayıt içeriyor.',
});

export const batchPhotoAdjustmentsSchema = z.object({
  classId: id.optional(),
  photoIds: z.array(id).min(1, 'En az 1 fotoğraf seçilmelidir.').max(20_000),
  sourceAdjustments: photoAdjustmentsSchema,
  copyFraming: z.boolean().optional(),
  perPhotoAdjustments: z.record(id, photoAdjustmentsSchema).optional(),
}).strict().refine(({ photoIds }) => new Set(photoIds).size === photoIds.length, {
  message: 'Fotoğraf seçimi tekrar eden kayıt içeriyor.',
}).refine(({ photoIds, perPhotoAdjustments }) => {
  if (!perPhotoAdjustments) return true;
  const allowed = new Set(photoIds);
  return Object.keys(perPhotoAdjustments).every((k) => allowed.has(k));
}, {
  message: 'Akıllı kadraj haritasında kapsam dışı fotoğraf kimliği var.',
});

export const batchApprovePhotosSchema = z.object({
  classId: id.optional(),
  photoIds: z.array(id).min(1, 'Onaylanacak en az 1 fotoğraf seçilmelidir.').max(20_000),
  approved: z.boolean(),
}).strict().refine(({ photoIds }) => new Set(photoIds).size === photoIds.length, {
  message: 'Fotoğraf seçimi tekrar eden kayıt içeriyor.',
});

export type PhotoBatchMatchMode = z.infer<typeof photoBatchMatchModeSchema>;
export type PhotoBatchMatchInput = z.infer<typeof photoBatchMatchSchema>;
export type DeleteStudioPhotosInput = z.infer<typeof deleteStudioPhotosSchema>;
export type BatchPhotoAdjustmentsInput = z.infer<typeof batchPhotoAdjustmentsSchema>;
export type BatchApprovePhotosInput = z.infer<typeof batchApprovePhotosSchema>;
