// VendeFrío - Cómo se usa la app (Etapa 8).
// Las explicaciones en pasos cortos que usa el Asistente cuando le
// preguntan "¿cómo hago…?". Cada tema tiene palabras que lo reconocen.
(function () {
    "use strict";

    const TEMAS = [
        {
            id: "cargarPedido", titulo: "Cargar un pedido",
            claves: /(cargo|cargar|hago|hacer|armo|tomo|tomar|anoto|anotar) (un )?pedido|pedido nuevo|nuevo pedido/,
            pasos: ["Tocá el + de abajo o «Cargar un pedido» en Inicio.", "Elegí el comercio.", "Sumá los productos con el +.", "Tocá «Guardar pedido»."]
        },
        {
            id: "armarPedido", titulo: "Armar un pedido",
            claves: /(armo|armar|preparo|preparar|tildo|tildar)( el| un| los)? pedido|marcar? preparado|checklist/,
            pasos: ["Entrá a Pedidos, pestaña «Para armar».", "Tocá el pedido.", "Tildá cada producto a medida que lo armás.", "Tocá «Marcar preparado»."]
        },
        {
            id: "repartir", titulo: "Salir a repartir",
            claves: /(salir|salgo) a repartir|reparto|repartir/,
            pasos: ["Entrá a Pedidos y tocá el pedido.", "Tocá «Salir a repartir».", "Para varios juntos, mantené apretada una tarjeta, elegí los otros y tocá «Salir a repartir»."]
        },
        {
            id: "entregar", titulo: "Marcar un pedido entregado",
            claves: /entreg/,
            pasos: ["Entrá a Pedidos, pestaña «Para entregar».", "Tocá el pedido.", "Deslizá el botón «Deslizá para marcar Entregado».", "Si hubo cambios, tocá «Más opciones» y «Entregar con cambios»."]
        },
        {
            id: "cobrar", titulo: "Registrar un cobro",
            claves: /cobr|pago|pagaron|me pago|fiado|deuda/,
            pasos: ["Abrí el pedido entregado (Pedidos › Otros › A cobrar).", "Tocá «Registrar cobro».", "Elegí cómo pagó y cuánto.", "Tocá «Guardar cobro»."]
        },
        {
            id: "comercio", titulo: "Agregar un comercio",
            claves: /(agrego|agregar|sumo|sumar|cargo|cargar|nuevo|alta).{0,12}(comercio|cliente|kiosco|almacen)/,
            pasos: ["Abajo, tocá «Comercios».", "Tocá «Agregar comercio».", "Escribí el nombre, la dirección y el teléfono.", "Guardalo. Si estás en la puerta, tocá «Actualizar con mi GPS» en su ficha."]
        },
        {
            id: "producto", titulo: "Agregar un producto o cambiar un precio",
            claves: /(agrego|agregar|sumo|sumar|cargo|cargar|nuevo|alta).{0,12}(producto|marca)|precio de lista|cambi.{0,12}precio|subir (los )?precios/,
            pasos: ["Abajo, tocá «Catálogo».", "Para el precio, tocá los tres puntos del producto y «Editar precio o foto».", "Para productos o marcas nuevas, entrá a la pestaña «Editar marcas» y tocá «Agregar producto» o «Agregar marca»."]
        },
        {
            id: "precioPedido", titulo: "Un precio especial en un pedido",
            claves: /precio (especial|distinto)|descuento|rebaja/,
            pasos: ["En el pedido nuevo, tocá el precio del producto (el del lapicito).", "Escribí el precio para este pedido.", "Tocá «Guardar precio». El de lista no cambia."]
        },
        {
            id: "cambio", titulo: "Anotar un cambio de mercadería",
            claves: /cambio|vencid|roto|devoluci|devolver/,
            pasos: ["En el pedido nuevo, tocá el botón redondo ⋯ de abajo.", "Tocá «Anotar un cambio».", "Elegí el producto, la cantidad y el motivo.", "Tocá «Guardar cambio»."]
        },
        {
            id: "repetir", titulo: "Repetir el último pedido",
            claves: /repet|lo (mismo|de siempre)|igual que/,
            pasos: ["En el pedido nuevo, elegí el comercio.", "Tocá el botón redondo ⋯ de abajo.", "Tocá «Repetir último pedido»."]
        },
        {
            id: "ticket", titulo: "Imprimir el ticket",
            claves: /ticket|imprim|impresora/,
            pasos: ["Prendé la impresora Bluetooth.", "Abrí el pedido y tocá «Más opciones».", "Tocá «Imprimir ticket». La primera vez elegí la impresora."]
        },
        {
            id: "linkPedido", titulo: "Que un comercio pida solo",
            claves: /pida solo|link|enlace|pedir solo/,
            pasos: ["Abrí la ficha del comercio.", "Tocá «Más opciones».", "Tocá «Link para que pida solo» y mandalo por WhatsApp.", "Lo que pida te llega a Inicio para cargarlo con un toque."]
        },
        {
            id: "ruta", titulo: "Armar la ruta o ir a un comercio",
            claves: /ruta|recorrido|como llego|navegar|mapa/,
            pasos: ["En Más, tocá «Rutas».", "Elegí los comercios y tocá «Optimizar ruta».", "Para ir a uno solo, en su ficha tocá «Ir»."]
        },
        {
            id: "empleados", titulo: "Sumar un empleado",
            claves: /emplead|vendedor|repartidor|permiso|rol/,
            pasos: ["Tocá tu inicial arriba a la derecha (Más).", "Entrá a «Empleados y roles» y generá un código.", "El empleado elige «Empleado» al entrar a la app y escribe ese código.", "Elegí qué puede hacer cada uno."]
        },
        {
            id: "respaldo", titulo: "Guardar un respaldo",
            claves: /respaldo|backup|copia|perder (los )?datos/,
            pasos: ["Tocá tu inicial arriba a la derecha (Más).", "Entrá a «Datos y respaldo».", "Tocá el botón del respaldo y guardá el archivo en el celular."]
        },
        {
            id: "letra", titulo: "Letra más grande o modo oscuro",
            claves: /letra|tamano|grande|oscuro|claro|apariencia|no veo/,
            pasos: ["Tocá tu inicial arriba a la derecha (Más).", "Entrá a «Apariencia».", "En «Tamaño del texto» elegí uno más grande, y arriba si la querés clara u oscura."]
        },
        {
            id: "cierre", titulo: "Cerrar el día",
            claves: /cierre|cerrar (el )?dia|rendir|rendicion/,
            pasos: ["En Más, tocá «Cierre del día».", "Revisá lo vendido, lo cobrado y lo que falta.", "Compartilo si lo tenés que rendir."]
        },
        {
            id: "whatsapp", titulo: "Pedidos por WhatsApp",
            claves: /whatsapp|wasap|mensaje/,
            pasos: ["En Más, tocá «WhatsApp».", "Desde ahí mandás la ronda de pedidos y revisás los mensajes que llegaron.", "Un pedido pegado se arma solo con «Dictar o pegar pedido» (botón ⋯ del pedido)."]
        },
        {
            id: "archivar", titulo: "Archivar un comercio o un producto",
            claves: /archiv|borrar|eliminar|sacar/,
            pasos: ["Comercio: en su ficha tocá «Más opciones» y «Archivar comercio».", "Producto: en Catálogo, tres puntos y «Archivar».", "Si te equivocaste, tocá «Deshacer» en el aviso. Los archivados se recuperan desde «Archivados»."]
        },
        {
            id: "asistente", titulo: "Qué puede hacer el Asistente",
            claves: /que (podes|sabes|puedo) (hacer|decir|preguntar)|ayuda|como funciona|para que sirve/,
            pasos: ["Dale órdenes: «nuevo pedido para Don Pepe», «llevame a Super Norte», «llegué».", "Preguntale por tus números: «¿cuánto vendí hoy?», «¿quién me debe?».", "Preguntale cómo se usa algo: «¿cómo registro un cobro?».", "Pedime varias cosas juntas: «anotá un pedido para Don Pepe, 5 ravioles, e imprimí el ticket». Antes de guardar o imprimir te muestro qué voy a hacer y espero tu «sí».", "Estoy en todas las pantallas (la chispa de arriba a la derecha) y sé lo que estás viendo: navegando, «vamos a lo de Pepe primero»; con un pedido abierto, «imprimí el ticket».", "Lo fácil lo contesto al toque, también sin internet. Lo demás se lo pregunto a Claude, con internet."]
        }
    ];

    function normalizar(texto) {
        return String(texto || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();
    }

    // El tema que mejor contesta "¿cómo hago…?", o null.
    function buscar(texto) {
        const dicho = normalizar(texto);
        if (!dicho) return null;
        return TEMAS.find(tema => tema.claves.test(dicho)) || null;
    }

    // Toda la guía en texto, para que la IA también la conozca.
    function guiaEnTexto() {
        return TEMAS.map(tema => "### " + tema.titulo + "\n" + tema.pasos.map((paso, indice) => (indice + 1) + ". " + paso).join("\n")).join("\n\n");
    }

    window.ayudaVendeFrio = { temas: TEMAS, buscar, guiaEnTexto, normalizar };
}());
