package storage

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type S3Store struct {
	client        *s3.Client
	presignClient *s3.Client // separate client initialized with publicEndpoint for presigning
	bucket        string
}

// NewS3Store creates an S3Store. publicEndpoint may be empty, in which case
// presigned URLs will use the same endpoint as internal S3 calls.
func NewS3Store(region, bucket, endpoint, accessKey, secretKey, publicEndpoint string) (*S3Store, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config, %v", err)
	}

	if endpoint != "" {
		cfg.BaseEndpoint = aws.String(endpoint)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true // Required for MinIO
	})

	// Build a separate client for presigning. It must use the public endpoint so
	// the generated URL's host matches what browsers will send in the request —
	// AWS V4 includes the host header in the signature, so changing the host after
	// signing causes a 403.
	var presignS3Client *s3.Client
	pub := publicEndpoint
	if pub == "" {
		pub = endpoint
	}
	if pub != endpoint && pub != "" {
		pubCfg, err := config.LoadDefaultConfig(context.TODO(),
			config.WithRegion(region),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		)
		if err != nil {
			return nil, fmt.Errorf("unable to load SDK config for presign client, %v", err)
		}
		pubCfg.BaseEndpoint = aws.String(pub)
		presignS3Client = s3.NewFromConfig(pubCfg, func(o *s3.Options) {
			o.UsePathStyle = true
		})
	} else {
		presignS3Client = client
	}

	return &S3Store{
		client:        client,
		presignClient: presignS3Client,
		bucket:        bucket,
	}, nil
}

// EnsureBucket creates the bucket if it does not already exist.
func (s *S3Store) EnsureBucket(ctx context.Context) error {
	_, err := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "BucketAlreadyOwnedByYou") ||
			strings.Contains(errStr, "BucketAlreadyExists") {
			return nil
		}
		return fmt.Errorf("failed to create bucket %q: %w", s.bucket, err)
	}
	return nil
}

// EnsureBucketCORS sets a permissive CORS policy on the bucket so that browsers
// can fetch presigned URLs directly (e.g. from MinIO in dev). Safe to call on
// every startup — it is idempotent and a no-op in error (non-fatal).
func (s *S3Store) EnsureBucketCORS(ctx context.Context) error {
	_, err := s.client.PutBucketCors(ctx, &s3.PutBucketCorsInput{
		Bucket: aws.String(s.bucket),
		CORSConfiguration: &types.CORSConfiguration{
			CORSRules: []types.CORSRule{
				{
					AllowedMethods: []string{"GET", "HEAD"},
					AllowedOrigins: []string{"*"},
					AllowedHeaders: []string{"*"},
					MaxAgeSeconds:  aws.Int32(3600),
				},
			},
		},
	})
	return err
}

// Exists returns true if the key exists in the bucket (using a lightweight HeadObject).
func (s *S3Store) Exists(ctx context.Context, key string) bool {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err == nil
}

func (s *S3Store) Upload(ctx context.Context, key string, body io.Reader) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   body,
	})
	return err
}

// UploadCompressed uploads gzip-compressed content with proper Content-Type and
// Content-Encoding headers so that browsers can decompress it transparently when
// fetching via a presigned URL.
func (s *S3Store) UploadCompressed(ctx context.Context, key string, body io.Reader) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:          aws.String(s.bucket),
		Key:             aws.String(key),
		Body:            body,
		ContentType:     aws.String("application/json"),
		ContentEncoding: aws.String("gzip"),
	})
	return err
}

func (s *S3Store) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return output.Body, nil
}

func (s *S3Store) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

// GetPresignedURL generates a time-limited presigned GET URL for the given key.
// The URL is signed using the public-endpoint client so browsers can reach S3
// directly without any post-signing hostname rewriting (which would break the
// AWS V4 signature).
func (s *S3Store) GetPresignedURL(ctx context.Context, key string, lifetime time.Duration) (string, error) {
	pc := s3.NewPresignClient(s.presignClient)
	req, err := pc.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(o *s3.PresignOptions) {
		o.Expires = lifetime
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}
