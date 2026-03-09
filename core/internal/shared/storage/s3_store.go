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
	client           *s3.Client
	bucket           string
	// internalEndpoint is the endpoint used for server-side S3 calls (e.g. http://minio:9000).
	internalEndpoint string
	// publicEndpoint is the endpoint embedded in presigned URLs so browsers can reach S3
	// directly (e.g. http://localhost:9000 in Docker dev, or the CDN URL in production).
	// When empty, presigned URLs use internalEndpoint unchanged.
	publicEndpoint string
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

	pub := publicEndpoint
	if pub == "" {
		pub = endpoint
	}

	return &S3Store{
		client:           client,
		bucket:           bucket,
		internalEndpoint: endpoint,
		publicEndpoint:   pub,
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
// If a publicEndpoint is configured (different from the internal endpoint), the
// generated URL's host is rewritten so browsers can reach S3 directly.
func (s *S3Store) GetPresignedURL(ctx context.Context, key string, lifetime time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.client)
	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(o *s3.PresignOptions) {
		o.Expires = lifetime
	})
	if err != nil {
		return "", err
	}
	url := req.URL
	// Rewrite internal hostname → public hostname (Docker: minio:9000 → localhost:9000)
	if s.publicEndpoint != "" && s.internalEndpoint != "" && s.publicEndpoint != s.internalEndpoint {
		url = strings.Replace(url, s.internalEndpoint, s.publicEndpoint, 1)
	}
	return url, nil
}
