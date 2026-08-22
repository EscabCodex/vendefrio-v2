// VendeFrío - Catálogo móvil
(function () {
    function abrirCatalogo() {
        let pantalla = document.getElementById("pantallaCatalogo"); if (!pantalla) pantalla = crear();
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto")); pantalla.classList.remove("oculto"); renderizar();
    }
    function crear() {
        const s=document.createElement("section"); s.id="pantallaCatalogo"; s.className="oculto pantallaExtra"; s.innerHTML=`<header><div class="logo">🛍️</div><div><h1>Catálogo</h1><p>Productos y precios para vender</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><input id="buscarCatalogo" class="buscadorCatalogo" type="search" placeholder="Buscar producto o marca"><div id="grillaCatalogo" class="grillaCatalogo"></div></main></section>`; document.body.insertBefore(s,document.querySelector("nav.bottom-nav")); s.querySelector(".extraVolver").addEventListener("click",()=>{s.classList.add("oculto");mostrarPantalla("menu")}); s.querySelector("#buscarCatalogo").addEventListener("input",renderizar); return s;
    }
    function renderizar(){ const grilla=document.getElementById("grillaCatalogo"); if(!grilla)return; const texto=(document.getElementById("buscarCatalogo")?.value||"").toLowerCase(); const productos=typeof obtenerProductos==="function"?obtenerProductos():{}; grilla.innerHTML=""; Object.entries(productos).forEach(([marca,lista])=>(lista||[]).forEach(producto=>{const nombre=typeof producto==="string"?producto:producto.nombre||producto.producto||"Producto"; if((nombre+marca).toLowerCase().indexOf(texto)===-1)return; const card=document.createElement("article");card.className="itemCatalogo";card.innerHTML=`<div class="fotoCatalogo">${nombre.trim().slice(0,1).toUpperCase()}</div><strong></strong><small></small><b>${typeof producto==="object"&&producto.precio?"$ "+producto.precio:"Precio no cargado"}</b>`;card.querySelector("strong").textContent=nombre;card.querySelector("small").textContent=marca;grilla.appendChild(card)})); if(!grilla.children.length)grilla.innerHTML='<p class="catalogoVacio">No se encontraron productos.</p>'; }
    window.abrirCatalogo = abrirCatalogo;
    const b=document.createElement("button");b.type="button";b.className="menuBtn botonCatalogoInicio";b.textContent="🛍️ Catálogo";b.addEventListener("click",abrirCatalogo);const a=document.querySelector("#pantallaMenu .container > div[style*='grid-template-columns']");if(a && !document.querySelector(".botonCatalogoInicio"))a.appendChild(b);
}());
