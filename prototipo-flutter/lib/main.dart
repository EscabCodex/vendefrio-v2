// Prototipo de la pantalla Pedidos de VendeFrío en Flutter.
// Solo para comparar fluidez con la PWA: los datos son de ejemplo y se
// generan al abrir. No guarda nada ni se conecta a la nube.
import 'dart:math';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

void main() => runApp(const AppPrototipo());

// ---------- Colores (copiados de tema.css) ----------
class Paleta {
  final Color fondo, superficie, borde, texto, textoSec, textoTer, acento, acentoBg, acentoTxt;
  const Paleta({
    required this.fondo, required this.superficie, required this.borde,
    required this.texto, required this.textoSec, required this.textoTer,
    required this.acento, required this.acentoBg, required this.acentoTxt,
  });
  static const claro = Paleta(
    fondo: Color(0xFFEEF3FA), superficie: Color(0xFFFFFFFF), borde: Color(0xFFE1E8F2),
    texto: Color(0xFF0F1B2D), textoSec: Color(0xFF56657A), textoTer: Color(0xFF8392A6),
    acento: Color(0xFF1F5FE0), acentoBg: Color(0xFFDCE7FD), acentoTxt: Color(0xFFFFFFFF),
  );
  static const oscuro = Paleta(
    fondo: Color(0xFF0C0F13), superficie: Color(0xFF151A20), borde: Color(0xFF232A33),
    texto: Color(0xFFF2F4F6), textoSec: Color(0xFF99A2AD), textoTer: Color(0xFF6C7581),
    acento: Color(0xFFC8F04A), acentoBg: Color(0xFF252F14), acentoTxt: Color(0xFF0C0F13),
  );
}

// ---------- Datos de ejemplo ----------
enum Estado { cargado, enPreparacion, preparado, enReparto, entregado, aCobrar, incidencia, cancelado }

const nombresEstado = {
  Estado.cargado: 'Cargado', Estado.enPreparacion: 'En preparación', Estado.preparado: 'Preparado',
  Estado.enReparto: 'En reparto', Estado.entregado: 'Entregado', Estado.aCobrar: 'A cobrar',
  Estado.incidencia: 'Incidencia', Estado.cancelado: 'Cancelado',
};
const coloresEstado = {
  Estado.cargado: Color(0xFF8392A6), Estado.enPreparacion: Color(0xFFE8890C), Estado.preparado: Color(0xFF0B8457),
  Estado.enReparto: Color(0xFF7B4BE0), Estado.entregado: Color(0xFF0B8457), Estado.aCobrar: Color(0xFFE8890C),
  Estado.incidencia: Color(0xFFD12E2E), Estado.cancelado: Color(0xFF8392A6),
};
const coloresAvatar = [
  Color(0xFFFF8A3D), Color(0xFFF2A516), Color(0xFF8B5CF6), Color(0xFF14B8A6),
  Color(0xFFEC4899), Color(0xFF3B82F6), Color(0xFF22C55E), Color(0xFFEF4444),
];

class Pedido {
  final String id, comercio, direccion, cargo, hora;
  final int unidades, productos, total, avatar;
  final bool quiere;
  Estado estado;
  Pedido(this.id, this.comercio, this.direccion, this.cargo, this.hora, this.unidades,
      this.productos, this.total, this.avatar, this.quiere, this.estado);
  String get iniciales => comercio.substring(comercio.indexOf(' ') + 1).substring(0, 2).toUpperCase();
}

List<Pedido> generarPedidos(int cantidad) {
  final r = Random(42);
  const tipos = ['Kiosco', 'Almacén', 'Maxikiosco', 'Rotisería', 'Despensa', 'Autoservicio', 'Super', 'Panadería'];
  const nombres = ['La Esquina', 'Don Pepe', 'Plaza', 'La Estación', 'El Sol', 'Mi Barrio', 'Los Pinos', 'San Cayetano',
    'Doña Rosa', 'El Trébol', 'La Paloma', 'Avenida', 'Central', 'El Cruce', 'Lo de Tito', 'Las Heras'];
  const calles = ['Belgrano', 'San Martín', 'Lavalle', 'Rivadavia', 'Paraná', 'Mitre', 'Sarmiento', 'Corrientes', 'Urquiza', 'Moreno'];
  const quienes = ['Jere', 'Lucas', 'Sofi', 'Mati'];
  final estados = Estado.values;
  final pesos = [14, 8, 8, 6, 50, 6, 4, 4];
  final suma = pesos.reduce((a, b) => a + b);
  return List.generate(cantidad, (i) {
    var x = r.nextInt(suma), k = 0;
    while (x >= pesos[k]) { x -= pesos[k]; k++; }
    final u = 3 + r.nextInt(60);
    final h = 7 + r.nextInt(13), m = r.nextInt(60);
    final dia = i < cantidad * 0.15 ? 'Hoy' : (i < cantidad * 0.3 ? 'Ayer' : '${1 + r.nextInt(28)}/10');
    return Pedido(
      (r.nextInt(0xFFFFFF)).toRadixString(16).toUpperCase().padLeft(6, '0'),
      '${tipos[r.nextInt(tipos.length)]} ${nombres[r.nextInt(nombres.length)]}',
      '${calles[r.nextInt(calles.length)]} ${100 + r.nextInt(3900)}',
      quienes[r.nextInt(quienes.length)],
      '$dia ${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}',
      u, 1 + r.nextInt(8), u * (900 + r.nextInt(1800)) ~/ 10 * 10, r.nextInt(coloresAvatar.length),
      r.nextInt(4) == 0, estados[k],
    );
  });
}

String plata(int n) {
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return '\$ $b';
}

// ---------- Filtros ----------
enum Filtro { armar, entregar, terminados, aCobrar, incidencias, cancelados }

const nombresFiltro = {
  Filtro.armar: 'Para armar', Filtro.entregar: 'Para entregar', Filtro.terminados: 'Terminados',
  Filtro.aCobrar: 'A cobrar', Filtro.incidencias: 'Incidencias', Filtro.cancelados: 'Cancelados',
};

bool entraEnFiltro(Pedido p, Filtro f) => switch (f) {
      Filtro.armar => p.estado == Estado.cargado || p.estado == Estado.enPreparacion,
      Filtro.entregar => p.estado == Estado.preparado || p.estado == Estado.enReparto,
      Filtro.terminados => p.estado == Estado.entregado,
      Filtro.aCobrar => p.estado == Estado.aCobrar,
      Filtro.incidencias => p.estado == Estado.incidencia,
      Filtro.cancelados => p.estado == Estado.cancelado,
    };

// ---------- App ----------
class AppPrototipo extends StatefulWidget {
  const AppPrototipo({super.key});
  @override
  State<AppPrototipo> createState() => _AppPrototipoState();
}

class _AppPrototipoState extends State<AppPrototipo> {
  bool oscuro = false;
  bool medidor = false;
  // En la versión web se puede pedir otra cantidad con ?n=5000 en la dirección.
  int cantidad = int.tryParse(Uri.base.queryParameters['n'] ?? '') ?? 2000;

  @override
  Widget build(BuildContext context) {
    final pal = oscuro ? Paleta.oscuro : Paleta.claro;
    return MaterialApp(
      title: 'Pedidos (prototipo)',
      debugShowCheckedModeBanner: false,
      showPerformanceOverlay: medidor,
      theme: ThemeData(
        useMaterial3: true,
        brightness: oscuro ? Brightness.dark : Brightness.light,
        scaffoldBackgroundColor: pal.fondo,
        colorScheme: ColorScheme.fromSeed(
            seedColor: pal.acento, brightness: oscuro ? Brightness.dark : Brightness.light, primary: pal.acento),
      ),
      home: PantallaPedidos(
        key: ValueKey(cantidad),
        pal: pal,
        cantidad: cantidad,
        oscuro: oscuro,
        medidor: medidor,
        alCambiar: (o, m, c) => setState(() { oscuro = o; medidor = m; cantidad = c; }),
      ),
    );
  }
}

class PantallaPedidos extends StatefulWidget {
  final Paleta pal;
  final int cantidad;
  final bool oscuro, medidor;
  final void Function(bool oscuro, bool medidor, int cantidad) alCambiar;
  const PantallaPedidos({super.key, required this.pal, required this.cantidad, required this.oscuro,
      required this.medidor, required this.alCambiar});
  @override
  State<PantallaPedidos> createState() => _PantallaPedidosState();
}

class _PantallaPedidosState extends State<PantallaPedidos> {
  late List<Pedido> todos;
  late int msGenerar;
  Filtro filtro = Filtro.values.firstWhere((f) => f.name == Uri.base.queryParameters['f'], orElse: () => Filtro.armar);
  bool buscando = false;
  String busqueda = '';
  final elegidos = <String>{};
  bool get eligiendo => elegidos.isNotEmpty;
  final ctrlBusqueda = TextEditingController();

  @override
  void initState() {
    super.initState();
    final sw = Stopwatch()..start();
    todos = generarPedidos(widget.cantidad);
    msGenerar = sw.elapsedMilliseconds;
  }

  Paleta get pal => widget.pal;

  List<Pedido> get visibles {
    final q = busqueda.trim().toLowerCase();
    return [
      for (final p in todos)
        if (entraEnFiltro(p, filtro) &&
            (q.isEmpty || p.comercio.toLowerCase().contains(q) || p.direccion.toLowerCase().contains(q) || p.id.toLowerCase().contains(q)))
          p
    ];
  }

  int contar(Filtro f) => todos.where((p) => entraEnFiltro(p, f)).length;

  // Atrás del celular: un paso por vez (elegir varios → buscador → salir).
  bool get puedeSalir => !eligiendo && !buscando;
  void unPasoAtras() {
    setState(() {
      if (eligiendo) {
        elegidos.clear();
      } else if (buscando) {
        buscando = false;
        busqueda = '';
        ctrlBusqueda.clear();
      }
    });
  }

  void tocarPedido(Pedido p) {
    if (eligiendo) {
      setState(() => elegidos.contains(p.id) ? elegidos.remove(p.id) : elegidos.add(p.id));
    } else {
      abrirFicha(p);
    }
  }

  void abrirFicha(Pedido p) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: pal.superficie,
      barrierColor: Colors.black26,
      builder: (_) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 3, sigmaY: 3),
        child: FichaPedido(p: p, pal: pal),
      ),
    );
  }

  void moverElegidos(Estado? destino) {
    final n = elegidos.length;
    setState(() {
      if (destino == null) {
        todos.removeWhere((p) => elegidos.contains(p.id));
      } else {
        for (final p in todos) {
          if (elegidos.contains(p.id)) p.estado = destino;
        }
      }
      elegidos.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      content: Text(destino == null ? '$n pedidos eliminados' : '$n pedidos a ${nombresEstado[destino]}'),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final lista = visibles;
    final unidades = lista.fold<int>(0, (a, p) => a + p.unidades);
    final plataTotal = lista.fold<int>(0, (a, p) => a + p.total);
    return PopScope(
      canPop: puedeSalir,
      onPopInvokedWithResult: (hecho, _) { if (!hecho) unPasoAtras(); },
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: Column(children: [
            _encabezado(),
            _filaFiltros(),
            eligiendo ? _filaEligiendo(lista) : _filaResumen(lista.length, unidades, plataTotal),
            Expanded(
              child: lista.isEmpty
                  ? Center(child: Text('No hay pedidos acá', style: TextStyle(color: pal.textoSec)))
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
                      itemCount: lista.length,
                      itemBuilder: (_, i) {
                        final p = lista[i];
                        return TarjetaPedido(
                          key: ValueKey(p.id),
                          p: p, pal: pal,
                          elegido: elegidos.contains(p.id),
                          eligiendo: eligiendo,
                          alTocar: () => tocarPedido(p),
                          alMantener: () => setState(() => elegidos.add(p.id)),
                        );
                      },
                    ),
            ),
          ]),
        ),
        bottomNavigationBar: eligiendo ? _barraElegidos() : _barraInferior(),
      ),
    );
  }

  Widget _botonRedondo(IconData icono, {String? rotulo, VoidCallback? alTocar, bool relleno = false}) {
    final b = Material(
      color: relleno ? pal.acentoBg : pal.superficie,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: alTocar ?? () {},
        child: SizedBox(width: 44, height: 44, child: Icon(icono, size: 22, color: relleno ? pal.acento : pal.texto)),
      ),
    );
    if (rotulo == null) return b;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      b, const SizedBox(height: 2),
      Text(rotulo, style: TextStyle(fontSize: 11, color: pal.textoSec, fontWeight: FontWeight.w600)),
    ]);
  }

  Widget _encabezado() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _botonRedondo(Icons.arrow_back, alTocar: () => Navigator.maybePop(context)),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Pedidos', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: pal.texto)),
            ),
          ),
          _botonRedondo(Icons.question_mark_rounded, rotulo: 'Ayuda', relleno: true, alTocar: _abrirAjustesPrototipo),
          const SizedBox(width: 10),
          _botonRedondo(Icons.auto_awesome_outlined, rotulo: 'Asistente'),
        ]),
      );

  Widget _pildora(String texto, int cuenta, bool activa, VoidCallback alTocar, {bool flecha = false}) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: activa ? pal.acento : pal.superficie,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: alTocar,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(texto, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14,
                  color: activa ? pal.acentoTxt : pal.textoSec)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                decoration: BoxDecoration(
                  color: activa ? Colors.black.withValues(alpha: .18) : pal.fondo,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$cuenta', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                    color: activa ? pal.acentoTxt : pal.texto)),
              ),
              if (flecha) Icon(Icons.expand_more, size: 18, color: activa ? pal.acentoTxt : pal.textoSec),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _filaFiltros() {
    final esOtros = filtro.index >= Filtro.aCobrar.index;
    return SizedBox(
      height: 56,
      child: Row(children: [
        const SizedBox(width: 16),
        // Lupa primero; al abrirla aparece la píldora larga con X.
        _botonRedondo(Icons.search, alTocar: () => setState(() => buscando = true)),
        const SizedBox(width: 8),
        Expanded(
          child: buscando
              ? Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: TextField(
                    controller: ctrlBusqueda,
                    autofocus: true,
                    onChanged: (t) => setState(() => busqueda = t),
                    style: TextStyle(color: pal.texto),
                    decoration: InputDecoration(
                      hintText: 'Buscar comercio, dirección o Nº',
                      isDense: true,
                      filled: true,
                      fillColor: pal.superficie,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                      suffixIcon: IconButton(icon: const Icon(Icons.close, size: 18), onPressed: unPasoAtras),
                    ),
                  ),
                )
              : ListView(scrollDirection: Axis.horizontal, children: [
                  for (final f in [Filtro.armar, Filtro.entregar, Filtro.terminados])
                    _pildora(nombresFiltro[f]!, contar(f), filtro == f, () => setState(() { filtro = f; elegidos.clear(); })),
                  Builder(builder: (ctx) => _pildora(
                        esOtros ? nombresFiltro[filtro]! : 'Otros',
                        contar(Filtro.aCobrar) + contar(Filtro.incidencias) + contar(Filtro.cancelados),
                        esOtros, () => _menuOtros(ctx), flecha: true)),
                  const SizedBox(width: 8),
                ]),
        ),
      ]),
    );
  }

  Future<void> _menuOtros(BuildContext ctx) async {
    final caja = ctx.findRenderObject() as RenderBox;
    final pos = caja.localToGlobal(Offset(0, caja.size.height));
    final elegido = await showMenu<Filtro>(
      context: context,
      color: pal.superficie,
      position: RelativeRect.fromLTRB(pos.dx, pos.dy, pos.dx + 1, 0),
      items: [
        for (final (f, ic, c) in [
          (Filtro.aCobrar, Icons.payments_outlined, const Color(0xFFE8890C)),
          (Filtro.incidencias, Icons.flag_outlined, const Color(0xFFD12E2E)),
          (Filtro.cancelados, Icons.cancel_outlined, pal.textoTer),
        ])
          PopupMenuItem(value: f, child: Row(children: [
            Icon(ic, color: c, size: 20), const SizedBox(width: 10),
            Expanded(child: Text(nombresFiltro[f]!, style: TextStyle(color: pal.texto))),
            Text('${contar(f)}', style: TextStyle(color: pal.textoSec)),
          ])),
      ],
    );
    if (elegido != null) setState(() { filtro = elegido; elegidos.clear(); });
  }

  Widget _filaResumen(int n, int u, int total) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 2, 16, 8),
        child: Row(children: [
          Expanded(child: Text('$n pedidos · $u u · ${plata(total)}', maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: pal.textoSec, fontWeight: FontWeight.w700, fontSize: 14))),
          if (filtro == Filtro.armar)
            FilledButton.tonalIcon(
              style: FilledButton.styleFrom(backgroundColor: pal.acentoBg, foregroundColor: pal.acento),
              onPressed: () {}, icon: const Icon(Icons.add), label: const Text('Cargar pedido',
                  style: TextStyle(fontWeight: FontWeight.w700))),
        ]),
      );

  Widget _filaEligiendo(List<Pedido> lista) {
    final todosElegidos = lista.every((p) => elegidos.contains(p.id));
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 16, 6),
      child: Row(children: [
        IconButton(icon: Icon(Icons.close, color: pal.texto), onPressed: unPasoAtras),
        Expanded(child: Text('${elegidos.length} elegidos',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: pal.texto))),
        FilledButton.tonal(
          style: FilledButton.styleFrom(backgroundColor: pal.acentoBg, foregroundColor: pal.acento),
          onPressed: () => setState(() => todosElegidos
              ? elegidos.removeAll(lista.map((p) => p.id))
              : elegidos.addAll(lista.map((p) => p.id))),
          child: Text(todosElegidos ? 'Desmarcar todos' : 'Marcar todos', style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }

  Widget _barraElegidos() {
    final (texto, destino) = switch (filtro) {
      Filtro.armar => ('Salir a repartir', Estado.enReparto),
      Filtro.entregar => ('Entregado', Estado.entregado),
      _ => ('Para armar', Estado.cargado),
    };
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
        child: Row(children: [
          Expanded(
            child: FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: pal.acento, foregroundColor: pal.acentoTxt, minimumSize: const Size.fromHeight(50)),
              onPressed: () => moverElegidos(destino),
              child: Text('$texto (${elegidos.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(width: 10),
          PopupMenuButton<Estado?>(
            color: pal.superficie,
            onSelected: moverElegidos,
            itemBuilder: (_) => [
              for (final e in [Estado.enPreparacion, Estado.preparado, Estado.entregado])
                PopupMenuItem(value: e, child: Text(nombresEstado[e]!, style: TextStyle(color: pal.texto))),
              const PopupMenuDivider(),
              const PopupMenuItem(value: null, child: Text('Eliminar', style: TextStyle(color: Color(0xFFD12E2E)))),
            ],
            child: CircleAvatar(radius: 25, backgroundColor: pal.superficie,
                child: Icon(Icons.more_horiz, color: pal.texto)),
          ),
        ]),
      ),
    );
  }

  Widget _barraInferior() {
    Widget item(IconData i, String t, bool activo) => Expanded(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(color: activo ? pal.acentoBg : null, borderRadius: BorderRadius.circular(14)),
              child: Icon(i, color: activo ? pal.acento : pal.textoTer),
            ),
            const SizedBox(height: 2),
            Text(t, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: activo ? pal.acento : pal.textoTer)),
          ]),
        );
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(color: pal.superficie, borderRadius: BorderRadius.circular(26)),
        child: Row(children: [
          item(Icons.home_outlined, 'Inicio', false),
          item(Icons.list, 'Pedidos', true),
          Expanded(child: CircleAvatar(radius: 26, backgroundColor: pal.acento,
              child: Icon(Icons.add, color: pal.acentoTxt, size: 28))),
          item(Icons.storefront_outlined, 'Comercios', false),
          item(Icons.shopping_bag_outlined, 'Catálogo', false),
          item(Icons.menu, 'Más', false),
        ]),
      ),
    );
  }

  void _abrirAjustesPrototipo() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      backgroundColor: pal.superficie,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Prototipo', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: pal.texto)),
            const SizedBox(height: 4),
            Text('${todos.length} pedidos de ejemplo, generados en $msGenerar ms.',
                style: TextStyle(color: pal.textoSec)),
            const SizedBox(height: 16),
            Text('Cantidad de pedidos', style: TextStyle(fontWeight: FontWeight.w700, color: pal.texto)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: [
              for (final c in [500, 2000, 5000, 10000])
                ChoiceChip(
                  label: Text('$c'),
                  selected: widget.cantidad == c,
                  onSelected: (_) { Navigator.pop(context); widget.alCambiar(widget.oscuro, widget.medidor, c); },
                ),
            ]),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Modo oscuro', style: TextStyle(color: pal.texto)),
              value: widget.oscuro,
              onChanged: (v) { Navigator.pop(context); widget.alCambiar(v, widget.medidor, widget.cantidad); },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Medidor de cuadros', style: TextStyle(color: pal.texto)),
              subtitle: Text('Barras verdes = fluido; rojas = trabado', style: TextStyle(color: pal.textoSec)),
              value: widget.medidor,
              onChanged: (v) { Navigator.pop(context); widget.alCambiar(widget.oscuro, v, widget.cantidad); },
            ),
          ]),
        ),
      ),
    );
  }
}

// ---------- Tarjeta ----------
class TarjetaPedido extends StatelessWidget {
  final Pedido p;
  final Paleta pal;
  final bool elegido, eligiendo;
  final VoidCallback alTocar, alMantener;
  const TarjetaPedido({super.key, required this.p, required this.pal, required this.elegido,
      required this.eligiendo, required this.alTocar, required this.alMantener});

  Widget _linea(IconData i, String t) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          Icon(i, size: 17, color: pal.textoSec), const SizedBox(width: 8),
          Expanded(child: Text(t, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14.5, color: pal.texto))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final ce = coloresEstado[p.estado]!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: elegido ? pal.acentoBg : pal.superficie,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: elegido ? BorderSide(color: pal.acento, width: 2) : BorderSide(color: pal.borde, width: 0),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: alTocar,
          onLongPress: alMantener,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Avatar: al elegir varios se vuelve un tilde.
              Container(
                width: 46, height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: elegido ? pal.acento : (eligiendo ? Colors.transparent : coloresAvatar[p.avatar]),
                  borderRadius: BorderRadius.circular(14),
                  border: eligiendo && !elegido ? Border.all(color: pal.textoTer, width: 1.5) : null,
                ),
                child: elegido
                    ? Icon(Icons.check_circle_outline, color: pal.acentoTxt)
                    : (eligiendo
                        ? null
                        : Text(p.iniciales, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(p.comercio, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: pal.texto))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: ce.withValues(alpha: .14), borderRadius: BorderRadius.circular(10)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: ce, shape: BoxShape.circle)),
                        const SizedBox(width: 5),
                        Text(nombresEstado[p.estado]!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: ce)),
                      ]),
                    ),
                  ]),
                  _linea(Icons.schedule, '${p.hora} · cargó ${p.cargo}'),
                  _linea(Icons.inventory_2_outlined, '${p.unidades} unidades · ${p.productos} ${p.productos == 1 ? 'producto' : 'productos'}'),
                  _linea(Icons.place_outlined, p.direccion),
                  Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1, color: pal.borde)),
                  Row(children: [
                    Text('Nº ${p.id}', style: TextStyle(color: pal.textoSec, fontWeight: FontWeight.w600)),
                    if (p.quiere) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: pal.acentoBg, borderRadius: BorderRadius.circular(8)),
                        child: Text('Quiere', style: TextStyle(color: pal.acento, fontWeight: FontWeight.w700, fontSize: 12)),
                      ),
                    ],
                    const Spacer(),
                    Text(plata(p.total), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: pal.texto)),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ---------- Ficha (hoja que se desliza para cerrar) ----------
class FichaPedido extends StatelessWidget {
  final Pedido p;
  final Paleta pal;
  const FichaPedido({super.key, required this.p, required this.pal});

  @override
  Widget build(BuildContext context) {
    final productos = List.generate(p.productos, (i) => ('Producto ${i + 1}', 1 + (p.unidades ~/ p.productos)));
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(radius: 22, backgroundColor: coloresAvatar[p.avatar],
                child: Text(p.iniciales, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
            const SizedBox(width: 12),
            Expanded(child: Text(p.comercio, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: pal.texto))),
          ]),
          const SizedBox(height: 12),
          Text('${p.direccion} · ${nombresEstado[p.estado]}', style: TextStyle(color: pal.textoSec)),
          const SizedBox(height: 12),
          for (final (n, u) in productos)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Expanded(child: Text(n, style: TextStyle(color: pal.texto))),
                Text('$u u', style: TextStyle(color: pal.textoSec, fontWeight: FontWeight.w600)),
              ]),
            ),
          Divider(color: pal.borde),
          Row(children: [
            Text('Total', style: TextStyle(color: pal.texto, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(plata(p.total), style: TextStyle(color: pal.texto, fontSize: 20, fontWeight: FontWeight.w800)),
          ]),
        ]),
      ),
    );
  }
}
