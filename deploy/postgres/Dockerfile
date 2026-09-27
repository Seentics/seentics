# Postgres 16 with the `hll` extension (HyperLogLog), which the analytics rollups use to
# count unique visitors across any range of days without re-reading raw events.
#
# Debian, not Alpine: postgresql-16-hll ships from the PGDG apt repository the official
# Debian image already configures. Do not switch an existing Alpine data directory to
# this image in place — musl and glibc collate text differently, which silently
# invalidates text indexes. Restore a dump into a fresh volume instead.
FROM postgres:16-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-hll \
 && rm -rf /var/lib/apt/lists/*
