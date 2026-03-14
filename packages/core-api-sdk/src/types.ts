export type CoreApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  message?: string;
};

export type CoreApiErrorEnvelope<Details = unknown> = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Details;
  };
};

export type CoreApiEnvelope<T, Details = unknown> =
  | CoreApiSuccessEnvelope<T>
  | CoreApiErrorEnvelope<Details>;

