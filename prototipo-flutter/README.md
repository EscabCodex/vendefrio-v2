# Prototipo Flutter: pantalla Pedidos

Proyecto aparte, **no toca la app de VendeFrío**. Sirve solo para comparar la
fluidez de Flutter con la PWA, usando miles de pedidos de ejemplo generados.

Qué tiene: encabezado, lupa, filtros con cantidad (Para armar, Para entregar,
Terminados, Otros), tarjetas de pedido, elegir varios (mantener apretado),
menú ⋯, hoja del pedido que se cierra deslizando, modo claro y oscuro, y el
botón atrás del celular de a un paso. En el botón "?" se elige cuántos pedidos
generar (500 a 10.000) y se puede prender el medidor de cuadros.

## Cómo compilarlo

1. Instalar Flutter (https://docs.flutter.dev/get-started/install).
2. En esta carpeta: `flutter pub get`.
3. Web: `flutter build web --release` (queda en `build/web`).
4. Android: `flutter build apk --release --split-per-abi`
   (queda en `build/app/outputs/flutter-apk/`).
