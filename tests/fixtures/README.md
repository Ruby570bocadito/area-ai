# Fixtures de tests

- `proveedor-test.crt` / `proveedor-test.key` — par RSA autofirmado generado
  solo para las pruebas de `tests/safe-fetch.test.ts` (tarea ssrf-ip-pinning).
  SAN: `DNS:proveedor.test` (no resuelve en ninguna red; el DNS lo simula el
  test). La clave es DESECHABLE y de uso exclusivo en tests: jamás usar como
  identidad real. Regenerable con:

  ```
  openssl req -x509 -newkey rsa:2048 -keyout proveedor-test.key \
    -out proveedor-test.crt -days 3650 -nodes -subj "/CN=proveedor.test" \
    -addext "subjectAltName=DNS:proveedor.test"
  ```
