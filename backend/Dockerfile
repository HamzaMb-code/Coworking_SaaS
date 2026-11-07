FROM php:8.4-apache-bookworm

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public \
    COMPOSER_ALLOW_SUPERUSER=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libonig-dev unzip \
    && docker-php-ext-install -j"$(nproc)" mbstring opcache pdo_mysql \
    && rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf \
    && a2enmod mpm_prefork headers rewrite \
    && mpm_loads="$(find /etc/apache2/mods-enabled -maxdepth 1 -type l -name 'mpm_*.load' -printf '%f\n')" \
    && test "$(printf '%s\n' "$mpm_loads" | wc -l)" -eq 1 \
    && test "$mpm_loads" = "mpm_prefork.load" \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php-upload.ini /usr/local/etc/php/conf.d/zz-upload-limits.ini
RUN php -r '$expected = ["upload_max_filesize" => "10M", "post_max_size" => "12M", "max_file_uploads" => "20"]; $scanned = php_ini_scanned_files() ?: ""; if (! str_contains($scanned, "zz-upload-limits.ini")) { fwrite(STDERR, "PHP upload limits config was not loaded.\n"); exit(1); } foreach ($expected as $directive => $value) { if (ini_get($directive) !== $value) { fwrite(STDERR, "$directive expected $value, got ".ini_get($directive)."\n"); exit(1); } }'

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --no-scripts

COPY . .

RUN composer dump-autoload --no-dev --optimize --no-interaction \
    && php artisan package:discover --ansi \
    && php artisan storage:link \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private storage/app/public bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/laravel-entrypoint
RUN chmod +x /usr/local/bin/laravel-entrypoint \
    && printf '%s\n' 'expose_php=Off' 'display_errors=Off' 'log_errors=On' 'opcache.enable=1' 'opcache.validate_timestamps=0' > /usr/local/etc/php/conf.d/production.ini

EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/laravel-entrypoint"]
CMD ["apache2-foreground"]
