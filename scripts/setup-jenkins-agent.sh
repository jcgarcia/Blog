#!/bin/bash
# Jenkins Agent Setup Script (OCI ARM)
# Ensures all required system dependencies are installed for autonomous CI/CD

set -e

# Update package index
sudo apt-get update

# Install required Java library for Jenkins plugins
sudo apt-get install -y libcommons-lang3-java

# (Optional) Add any other agent dependencies here

echo "✅ Jenkins agent dependencies installed. Ready for CI/CD."
