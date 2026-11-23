import {
  batchApprovePhotosSchema,
  batchPhotoAdjustmentsSchema,
  deleteStudioPhotosSchema,
  photoBatchMatchSchema,
} from '../schemas/photoManagementSchemas';
import { useValidatedStudioMutation } from './useStudioQueries';

export function useApplyClassPhotoMatchesMutation() {
  return useValidatedStudioMutation(photoBatchMatchSchema, (input, actions) => actions.applyClassPhotoMatches(input));
}

export function useDeleteStudioPhotosMutation() {
  return useValidatedStudioMutation(deleteStudioPhotosSchema, (input, actions) => actions.deleteStudioPhotos(input));
}

export function useBatchPhotoAdjustmentsMutation() {
  return useValidatedStudioMutation(batchPhotoAdjustmentsSchema, (input, actions) =>
    actions.applyBatchPhotoAdjustments(input),
  );
}

export function useBatchApprovePhotosMutation() {
  return useValidatedStudioMutation(batchApprovePhotosSchema, (input, actions) =>
    actions.approveStudioPhotosBatch(input),
  );
}
