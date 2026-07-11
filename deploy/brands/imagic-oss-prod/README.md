# imagic.art production storefront

This folder is the declared Kubernetes rollout source for the `imagic.art` shop frontend.

## Apply

```bash
kubectl --kubeconfig ~/.kube/config-singapore-external apply -k deploy/brands/imagic-oss-prod
kubectl --kubeconfig ~/.kube/config-singapore-external -n imagic-oss-prod rollout status deployment/imagic-shop
```

## Verify

```bash
kubectl --kubeconfig ~/.kube/config-singapore-external -n imagic-oss-prod get deploy imagic-shop -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
curl --noproxy '*' -sS https://imagic.art/en | grep -E 'image \\+ magic = imagic|imagic.art'
curl --noproxy '*' -sS https://imagic.art/api/extensions/plugin/imagic-core/api/api/credit-packs
```

Treat `imagic-oss-prod/imagic-shop` as the live production deployment for `https://imagic.art`.
Do not use `jiffoo-oss-dev/shop` as production evidence.
