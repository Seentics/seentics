// Package storage provides a thin S3/MinIO client wrapper used for
// storing large binary payloads (session replays) outside the main DB.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	awss3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
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

// DeletePrefix removes all objects whose key starts with prefix.
func (c *S3Client) DeletePrefix(ctx context.Context, prefix string) error {
	keys, err := c.ListKeys(ctx, prefix)
	if err != nil || len(keys) == 0 {
		return err
	}
	objs := make([]awss3types.ObjectIdentifier, len(keys))
	for i, k := range keys {
		k := k
		objs[i] = awss3types.ObjectIdentifier{Key: &k}
	}
	_, err = c.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: &c.bucket,
		Delete: &awss3types.Delete{Objects: objs, Quiet: aws.Bool(true)},
	})
	return err
}

// SessionKey returns the S3 key for a replay chunk.
// Pattern: sessions/{websiteID}/{sessionID}/{tsMs:016d}_{wallNanos:020d}.json
// The nanosecond suffix prevents two flushes in the same millisecond from overwriting the same object.
func SessionKey(websiteID, sessionID string, tsMs int64) string {
	return fmt.Sprintf("sessions/%s/%s/%016d_%020d.json", websiteID, sessionID, tsMs, time.Now().UnixNano())
}

// SessionPrefix returns the listing prefix for all chunks of a session.
func SessionPrefix(websiteID, sessionID string) string {
	return fmt.Sprintf("sessions/%s/%s/", websiteID, sessionID)
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
