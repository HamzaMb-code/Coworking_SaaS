#!/bin/sh
set -eu

port="${PORT:-10000}"
case "$port" in
    *[!0-9]*|'') echo "PORT must be a numeric TCP port" >&2; exit 1 ;;
esac

sed -i "s/^Listen .*/Listen ${port}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:10000>/<VirtualHost *:${port}>/" /etc/apache2/sites-available/000-default.conf

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private storage/app/public bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

php artisan config:cache
exec "$@"
