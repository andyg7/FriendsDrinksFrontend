#!/usr/bin/env bash

set -e

docker-compose -f docker-compose.yml down --remove-orphans
