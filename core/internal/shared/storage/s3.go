// Package storage provides a thin S3/MinIO client wrapper used for
// storing large binary payloads (session replays) outside the main DB.
package storage

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	awss3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// S3Client wraps the AWS S3 client with helpers tailored for replay storage.
type S3Client struct {
	client *s3.Client
	bucket string
}

// NewS3Client creates an S3Client pointed at a MinIO (or any S3-compatible)
// endpoint. Pass useSSL=false for local MinIO without TLS.
// endpoint may be a bare host:port (e.g. "minio:9000") or a full URL
// (e.g. "http://minio:9000"); the scheme is added only when absent.
func NewS3Client(endpoint, accessKey, secretKey, bucket, region string, useSSL bool) (*S3Client, error) {
	endpointURL := endpoint
	if !strings.Contains(endpoint, "://") {
		scheme := "http"
		if useSSL {
			scheme = "https"
		}
		endpointURL = fmt.Sprintf("%s://%s", scheme, endpoint)
	}

	cfg := aws.Config{
		Region:      region,
		Credentials: credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		EndpointResolverWithOptions: aws.EndpointResolverWithOptionsFunc(
			func(service, reg string, opts ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:               endpointURL,
					HostnameImmutable: true,
				}, nil
			},
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true // required for MinIO
	})

	c := &S3Client{client: client, bucket: bucket}
	if err := c.ensureBucket(context.Background()); err != nil {
		return nil, fmt.Errorf("s3: ensure bucket %q: %w", bucket, err)
	}
	return c, nil
}

// PutJSON serialises v as JSON and uploads it at key.
func (c *S3Client) PutJSON(ctx context.Context, key string, v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("s3 put json marshal: %w", err)
	}
	ct := "application/json"
	_, err = c.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &c.bucket,
		Key:         &key,
		Body:        bytes.NewReader(data),
		ContentType: &ct,
	})
	return err
}

// GetJSON downloads key and unmarshals JSON into dst.
func (c *S3Client) GetJSON(ctx context.Context, key string, dst interface{}) error {
	out, err := c.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	if err != nil {
		return fmt.Errorf("s3 get %q: %w", key, err)
	}
	defer out.Body.Close()
	data, err := io.ReadAll(out.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dst)
}

// PutGzipJSON marshals v as JSON, gzip-compresses, and uploads at key (e.g. bundle.json.gz).
func (c *S3Client) PutGzipJSON(ctx context.Context, key string, v interface{}) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("s3 put gzip json marshal: %w", err)
	}
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(raw); err != nil {
		return fmt.Errorf("s3 put gzip write: %w", err)
	}
	if err := gw.Close(); err != nil {
		return fmt.Errorf("s3 put gzip close: %w", err)
	}
	ct := "application/gzip"
	_, err = c.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &c.bucket,
		Key:         &key,
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: &ct,
	})
	return err
}

// GetJSONGzip downloads a gzip-compressed JSON payload and unmarshals into dst.
func (c *S3Client) GetJSONGzip(ctx context.Context, key string, dst interface{}) error {
	out, err := c.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	if err != nil {
		return fmt.Errorf("s3 get gzip %q: %w", key, err)
	}
	defer out.Body.Close()
	comp, err := io.ReadAll(out.Body)
	if err != nil {
		return err
	}
	gr, err := gzip.NewReader(bytes.NewReader(comp))
	if err != nil {
		return fmt.Errorf("s3 gzip reader %q: %w", key, err)
	}
	defer gr.Close()
	plain, err := io.ReadAll(gr)
	if err != nil {
		return err
	}
	return json.Unmarshal(plain, dst)
}

// GetJSONGzipWithRetry downloads a gzipped JSON payload with retries.
func (c *S3Client) GetJSONGzipWithRetry(ctx context.Context, key string, dst interface{}) error {
	var last error
	for attempt := range 3 {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(50*attempt) * time.Millisecond):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		last = c.GetJSONGzip(ctx, key, dst)
		if last == nil {
			return nil
		}
	}
	return last
}

// GetJSONWithRetry downloads and unmarshals JSON, retrying transient failures.
func (c *S3Client) GetJSONWithRetry(ctx context.Context, key string, dst interface{}) error {
	var last error
	for attempt := range 3 {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(50*attempt) * time.Millisecond):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		last = c.GetJSON(ctx, key, dst)
		if last == nil {
			return nil
		}
	}
	return last
}

// ObjectExists reports whether an object is present at key (HeadObject).
func (c *S3Client) ObjectExists(ctx context.Context, key string) (bool, error) {
	_, err := c.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	if err == nil {
		return true, nil
	}
	var re *smithyhttp.ResponseError
	if errors.As(err, &re) && re.HTTPStatusCode() == 404 {
		return false, nil
	}
	low := strings.ToLower(err.Error())
	if strings.Contains(low, "notfound") || strings.Contains(low, "no such key") || strings.Contains(low, "nosuchkey") {
		return false, nil
	}
	return false, err
}

// PresignGetObject returns a time-limited HTTPS GET URL for an object (R2/S3/MinIO).
func (c *S3Client) PresignGetObject(ctx context.Context, key string, expiry time.Duration) (string, error) {
	if expiry <= 0 {
		expiry = time.Hour
	}
	presigner := s3.NewPresignClient(c.client)
	out, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("s3 presign get %q: %w", key, err)
	}
	return out.URL, nil
}

// ListKeys returns all object keys under prefix, sorted lexicographically.
func (c *S3Client) ListKeys(ctx context.Context, prefix string) ([]string, error) {
	var keys []string
	paginator := s3.NewListObjectsV2Paginator(c.client, &s3.ListObjectsV2Input{
		Bucket: &c.bucket,
		Prefix: &prefix,
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("s3 list %q: %w", prefix, err)
		}
		for _, obj := range page.Contents {
			if obj.Key != nil {
				keys = append(keys, *obj.Key)
			}
		}
	}
	sort.Strings(keys)
	return keys, nil
}

// Delete removes a single object.
func (c *S3Client) Delete(ctx context.Context, key string) error {
	_, err := c.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	return err
}

// s3DeleteBatchSize is the maximum number of objects per DeleteObjects call (S3 hard limit).
const s3DeleteBatchSize = 1000

// DeletePrefix removes all objects whose key starts with prefix.
// Batches deletions in groups of 1000 to respect S3's DeleteObjects limit.
func (c *S3Client) DeletePrefix(ctx context.Context, prefix string) error {
	keys, err := c.ListKeys(ctx, prefix)
	if err != nil || len(keys) == 0 {
		return err
	}
	for i := 0; i < len(keys); i += s3DeleteBatchSize {
		end := i + s3DeleteBatchSize
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]
		objs := make([]awss3types.ObjectIdentifier, len(batch))
		for j, k := range batch {
			k := k
			objs[j] = awss3types.ObjectIdentifier{Key: &k}
		}
		if _, err := c.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: &c.bucket,
			Delete: &awss3types.Delete{Objects: objs, Quiet: aws.Bool(true)},
		}); err != nil {
			return err
		}
	}
	return nil
}

// SessionPrefix returns the listing prefix for all chunks of a session.
func SessionPrefix(websiteID, sessionID string) string {
	return fmt.Sprintf("sessions/%s/%s/", websiteID, sessionID)
}

// SessionBundleKey returns the object key for a single gzipped JSON array of all replay events.
func SessionBundleKey(websiteID, sessionID string) string {
	return fmt.Sprintf("sessions/%s/%s/bundle.json.gz", websiteID, sessionID)
}

// ensureBucket creates the bucket if it doesn't exist.
func (c *S3Client) ensureBucket(ctx context.Context) error {
	_, err := c.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &c.bucket})
	if err == nil {
		return nil
	}
	if !strings.Contains(err.Error(), "NoSuchBucket") && !strings.Contains(err.Error(), "NotFound") {
		return err
	}
	_, err = c.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &c.bucket})
	return err
}
