# Kubernetes Manifests

## OIDC Configuration

The OIDC discovery service uses a JWKS (JSON Web Key Set) for token validation.

### Files

- **`jwks.json`** - Source JSON file with RSA public keys
- **`oidc-configmap.yaml`** - Kubernetes ConfigMap generated from `jwks.json`

### Updating JWKS

If you need to update the public keys:

1. Edit `jwks.json` with the new key data
2. Regenerate the ConfigMap (requires kubectl on oracledev):
   ```bash
   ssh oracledev
   cd /path/to/k8s
   kubectl create configmap oidc-jwks --from-file=jwks.json -n kube-system --dry-run=client -o yaml > oidc-configmap.yaml
   ```
3. Commit both files
4. Deploy via Jenkins

### Why Two Files?

- `jwks.json` is the **source of truth** - clean JSON, easy to edit
- `oidc-configmap.yaml` is the **deployment manifest** - generated from source
- Separates concerns: data (JSON) vs infrastructure (K8s)
