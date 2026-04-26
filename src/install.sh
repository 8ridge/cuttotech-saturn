#!/bin/bash

# URL Shortener - Скрипт установки для Ubuntu 22.04
# Автоматическая установка и настройка проекта

set -e

echo "================================"
echo "URL Shortener - Установка"
echo "================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Проверка что скрипт не запущен с sudo
if [ "$EUID" -eq 0 ]; then 
    print_error "Не запускайте этот скрипт с sudo!"
    print_info "Запусти��е: ./install.sh"
    exit 1
fi

echo "Шаг 1: Проверка Node.js..."
if ! command -v node &> /dev/null; then
    print_warning "Node.js не установлен. Устанавливаю..."
    
    # Установка Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    print_success "Node.js установлен"
else
    NODE_VERSION=$(node -v)
    print_success "Node.js уже установлен: $NODE_VERSION"
fi

echo ""
echo "Шаг 2: Проверка npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm не найден!"
    exit 1
else
    NPM_VERSION=$(npm -v)
    print_success "npm установлен: $NPM_VERSION"
fi

echo ""
echo "Шаг 3: Настройка Supabase..."
SUPABASE_FILE="utils/supabase/info.tsx"

if [ ! -f "$SUPABASE_FILE" ]; then
    print_error "Файл $SUPABASE_FILE не найден!"
    exit 1
fi

# Проверка наличия настроек Supabase
if grep -q "your-project-id\|your-anon-key-here\|your-anon-key-here" "$SUPABASE_FILE"; then
    print_warning "Обнаружены настройки по умолчанию в $SUPABASE_FILE"
    echo ""
    print_infprint_info "НеобходимНеобходимо н настроитьроить подподключенлючение к Supabase"
    echo ""
    echo "Нк Supabase"
    echo ""
    echo "Найти этйти эти данные можно вможно в Supabase Dashboard → Settings → API Dashboard → Settings → API"
    echo ""
    
    read -p "Project ID: " PROJECT_ID
    read -p "Public Anon Key: " ANON_KEY
    
    if [ -z "$PROJECT_ID" ] || [ -z "$ANON_KEY" ]; then
        print_error "Project ID и Anon Key обязательны!"
        print_info "Вы можете настроить их позже в файле: $SUPABASE_FILE"
    else
        if [ -z "$PROJECT_ID" ] || [ -z "$ANON_KEY" ]; then
        print_error "Project ID и Anon Key обязательны!"
        print_info "Вы можете настроить их позже в файле: $SUPABASE_FILE"
    else
        # Создаем резервную копию
            cp "$SUPABASE_FILE" "$SUPABASE_FILE.backup"
            
            # Обновляем файл
            sed -i "s/your-project-id/$PROJECT_ID/g" "$SUPABASE_FILE"
            sed -i "s/your-anon-key-here/$ANON_KEY/g" "$SUPABASE_FILE"
            
            print_success "Настройки Supabase обновлены"
    fi
    fi
else
    print_success "Настройки Supabase уже заданы"
fi

echo ""
echo "Шаг 4: Установка зависимостей..."
print_info "Это может занять несколько минут..."

if npm install; then
    print_success "Зависимости установлены"
else
    print_error "Ошибка при установке зависимостей"
    exit 1
fi

echo ""
echo "Шаг 5: Сборка проекта..."
if npm run build; then
    print_success "Проект успешно собран"
else
    print_error "Ошибка при сборке проекта"
    exit 1
fi

echo ""
echo "================================"
print_success "Установка завершена!"
echo "================================"
echo ""
echo "Для запуска проекта выполните:"
echo ""
echo "  Режим разработки:"
echo "  npm run dev -- --host 0.0.0.0 --port 3000"
echo ""
echo "  Режим production:"
echo "  npm run preview -- --host 0.0.0.0 --port 3000"
echo ""
echo "Сайт будет доступен по адресу: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
print_info "Для настройки автозапуска смотрите UBUNTU_INSTALL.md"
echo ""
