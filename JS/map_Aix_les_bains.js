//  LOGIQUE DU POPUP INTRODUCTIF

// Récupération des éléments du DOM
var modal = document.getElementById("introModal");
var infoBtn = document.getElementById("infoBtn");
var closeSpan = document.getElementsByClassName("close")[0];
var closeModalBtn = document.getElementById("closeModalBtn");

// Fonction pour ouvrir le modal
function openModal() {
    modal.style.display = "block";
    document.body.classList.add('modal-open');
}

// Fonction pour fermer le modal
function closeModal() {
    modal.style.display = "none";
    document.body.classList.remove('modal-open');
}

// Ouvrir le modal automatiquement au chargement de la page
window.addEventListener('load', function() {
    openModal();
});

// Ouvrir le modal quand on clique sur le bouton "i"
infoBtn.addEventListener('click', openModal);

// Fermer quand on clique sur le (x)
closeSpan.addEventListener('click', closeModal);

// Fermer quand on clique sur le bouton "Accéder à la carte"
closeModalBtn.addEventListener('click', closeModal);

// Fermer quand on clique en dehors de la boîte modale
window.addEventListener('click', function(event) {
    if (event.target == modal) {
        closeModal();
    }
});


// Déplacer la ligne de séparation DANS le conteneur de la carte
// Cela corrige le décalage visuel et assure que les coordonnées sont synchronisées
var splitLineEl = document.getElementById('split-line');
var mapEl = document.getElementById('map');
if (splitLineEl && mapEl) {
    mapEl.appendChild(splitLineEl);
}

// Initialisation de la carte
var map = L.map('map').setView([45.69374,5.90960], 13);
//Permet de corriger le bug d'affichage qui coupe les données et la carte : https://stackoverflow.com/questions/36246815/data-toggle-tab-does-not-download-leaflet-map/36257493#36257493
window.dispatchEvent(new Event('resize'));

// Définition de la couche OSM
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

// OpenTopoMap
var openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
});

// Ajouter la couche par défaut OSM
osmLayer.addTo(map);

// Orthophoto layers with blue border
var orthophotoBounds = [
    [45.660754335, 5.854534581], // southwest corner
    [45.725912109, 5.957826408] // northeast corner 
];

var orthophoto2025 = L.imageOverlay('images/orthophoto_aix_2025.png', orthophotoBounds, {
    opacity: 0.7,
    className: 'orthophoto-layer'
});

var orthophoto2020 = L.imageOverlay('images/orthophoto_aix_2020.png', orthophotoBounds, {
    opacity: 0.7,
    className: 'orthophoto-layer'
});

// Create a dedicated pane for orthophoto borders so the stroke is not affected
map.createPane('orthophotoBorderPane');
map.getPane('orthophotoBorderPane').style.zIndex = 450; // above default overlayPane (400)
map.getPane('orthophotoBorderPane').style.pointerEvents = 'none';

// Rectangle used as the persistent blue border (not added to the map until an orthophoto is visible)
var orthophotoBorder = L.rectangle(orthophotoBounds, {
    color: 'blue',
    weight: 3,
    fill: false,
    interactive: false,
    pane: 'orthophotoBorderPane'
});


// Orthophotos

function updateOrthophoto2025Opacity(value) {
    var opacity = value / 100;
    if (orthophoto2025) {
        orthophoto2025.setOpacity(opacity);
    }
    document.getElementById('orthophoto-2025-opacity-value').textContent = value + '%';
}

function updateOrthophoto2020Opacity(value) {
    var opacity = value / 100;
    if (orthophoto2020) {
        orthophoto2020.setOpacity(opacity);
    }
    document.getElementById('orthophoto-2020-opacity-value').textContent = value + '%';
}

// Variables pour la ligne de séparation des orthophotos
var splitLine = null;
var isDragging = false;
var splitPosition = 50;
var mapContainer = null;

// Fonction pour obtenir les limites de l'image en coordonnées d'écran
// Cette fonction calcule les coordonnées par rapport au conteneur de la carte
function getOrthophotoScreenBounds() {
    var southWest = L.latLng(orthophotoBounds[0]);
    var northEast = L.latLng(orthophotoBounds[1]);
    
    var swPixel = map.latLngToContainerPoint(southWest);
    var nePixel = map.latLngToContainerPoint(northEast);

    return {
        left: Math.min(swPixel.x, nePixel.x),
        right: Math.max(swPixel.x, nePixel.x),
        top: Math.min(swPixel.y, nePixel.y),
        bottom: Math.max(swPixel.y, nePixel.y),
        width: Math.abs(nePixel.x - swPixel.x),
        height: Math.abs(swPixel.y - nePixel.y)
    };
}

// Fonction pour mettre à jour les masques de visibilité des orthophotos
function updateOrthophotoSplitMask() {
    if (!orthophoto2020 || !orthophoto2025) return;
    
    var p = splitPosition; 

    // Masquer la partie droite de 2020
    if (orthophoto2020.getElement()) {
        orthophoto2020.getElement().style.clipPath = `polygon(0% 0%, ${p}% 0%, ${p}% 100%, 0% 100%)`;
        orthophoto2020.getElement().style.webkitClipPath = `polygon(0% 0%, ${p}% 0%, ${p}% 100%, 0% 100%)`;
    }
    
    // Masquer la partie gauche de 2025
    if (orthophoto2025.getElement()) {
        orthophoto2025.getElement().style.clipPath = `polygon(${p}% 0%, 100% 0%, 100% 100%, ${p}% 100%)`;
        orthophoto2025.getElement().style.webkitClipPath = `polygon(${p}% 0%, 100% 0%, 100% 100%, ${p}% 100%)`;
    }
}

// Fonction pour créer la ligne de séparation
function createSplitLine() {
    var splitLineElement = document.getElementById('split-line');
    splitLineElement.style.display = 'block';
    
    // Empêcher le clic sur la ligne de se propager à la carte ---
    // Ceci permet de tirer la ligne sans que la carte ne bouge
    L.DomEvent.disableClickPropagation(splitLineElement);
    // -------
    
    mapContainer = document.getElementById('map');
    
    // Force update position
    updateSplitPosition(splitPosition);
    
    // Événements de drag
    splitLineElement.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', dragSplitLine);
    document.addEventListener('mouseup', stopDragging);
    
    // Appliquer les masques initiaux
    updateOrthophotoSplitMask();
}

function startDragging(e) {
    isDragging = true;
    e.preventDefault();
    // Désactiver temporairement le drag de la carte pour être sûr
    map.dragging.disable();
    document.body.classList.add('dragging-split-line');
}

// Logique de drag contrainte aux limites de l'image
function dragSplitLine(e) {
    if (!isDragging) return;
    
    // Obtenir la position X de la souris relative au conteneur de la carte
    var mapRect = mapContainer.getBoundingClientRect();
    var mouseX = e.clientX - mapRect.left;
    
    // Obtenir les limites de l'image
    var screenBounds = getOrthophotoScreenBounds();
    
    // Calculer X relatif au coin gauche de l'image
    var imageRelativeX = mouseX - screenBounds.left;
    
    // Contraindre la ligne strictement à l'intérieur de l'image
    if (imageRelativeX < 0) imageRelativeX = 0;
    if (imageRelativeX > screenBounds.width) imageRelativeX = screenBounds.width;
    
    // Calculer le pourcentage (0 à 100)
    splitPosition = (imageRelativeX / screenBounds.width) * 100;
    
    updateSplitPosition(splitPosition);
}

function stopDragging() {
    isDragging = false;
    // Réactiver le drag de la carte
    map.dragging.enable();
    document.body.classList.remove('dragging-split-line');
}

// Positionnement absolu basé sur les limites calculées
function updateSplitPosition(percentage) {
    var splitLineElement = document.getElementById('split-line');
    var screenBounds = getOrthophotoScreenBounds();

    // Calculer la position absolue en pixels dans le conteneur de la carte
    var leftPos = screenBounds.left + (screenBounds.width * (percentage / 100));

    splitLineElement.style.left = leftPos + 'px';
    splitLineElement.style.top = screenBounds.top + 'px';
    splitLineElement.style.height = screenBounds.height + 'px';
    
    updateOrthophotoSplitMask();
}

function removeSplitLine() {
    var splitLineElement = document.getElementById('split-line');
    splitLineElement.style.display = 'none';
    
    splitLineElement.removeEventListener('mousedown', startDragging);
    document.removeEventListener('mousemove', dragSplitLine);
    document.removeEventListener('mouseup', stopDragging);
    
    if (orthophoto2020 && orthophoto2020.getElement()) {
        orthophoto2020.getElement().style.clipPath = 'none';
        orthophoto2020.getElement().style.webkitClipPath = 'none';
    }
    if (orthophoto2025 && orthophoto2025.getElement()) {
        orthophoto2025.getElement().style.clipPath = 'none';
        orthophoto2025.getElement().style.webkitClipPath = 'none';
    }
    
    document.body.classList.remove('dragging-split-line');
}

function onOverlayAdd(e) {
    if (e.name === "Orthophoto 2020" || e.name === "Orthophoto 2025") {
        checkOrthophotoSplit();
    }
}

function onOverlayRemove(e) {
    if (e.name === "Orthophoto 2020" || e.name === "Orthophoto 2025") {
        checkOrthophotoSplit();
    }
}

function checkOrthophotoSplit() {
    var has2020 = map.hasLayer(orthophoto2020);
    var has2025 = map.hasLayer(orthophoto2025);
    
    if (has2020 && has2025) {
        createSplitLine();
    } else {
        removeSplitLine();
    }

    var hasEither = has2020 || has2025;
    if (hasEither) {
        if (!map.hasLayer(orthophotoBorder)) {
            orthophotoBorder.addTo(map);
        }
    } else {
        if (map.hasLayer(orthophotoBorder)) {
            map.removeLayer(orthophotoBorder);
        }
    }
}

// Create custom layer control
var CustomLayerControl = L.Control.Layers.extend({
    _addItem: function (obj) {
        var container = L.Control.Layers.prototype._addItem.call(this, obj);
        if (obj.overlay && (obj.name === "Orthophoto 2025" || obj.name === "Orthophoto 2020")) {
            var year = obj.name === "Orthophoto 2025" ? "2025" : "2020";
            var opacityHtml = `
                <div class="opacity-control" style="margin-left: 20px; margin-top: 5px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 3px;">Opacité:</div>
                    <input type="range" min="0" max="100" value="70" 
                           oninput="updateOrthophoto${year}Opacity(this.value)" 
                           style="width: 90%; height: 4px;">
                    <div style="text-align: center; font-size: 10px; color: #666;">
                        <span id="orthophoto-${year}-opacity-value">70%</span>
                    </div>
                </div>
            `;
            var opacityContainer = L.DomUtil.create('div', '', container);
            opacityContainer.innerHTML = opacityHtml;
        }
        return container;
    }
});

var baseMaps = {
    "OpenStreetMap": osmLayer,
    "Topographique": openTopoMap
};

var overlayMaps = {
    "Orthophoto 2025": orthophoto2025,
    "Orthophoto 2020": orthophoto2020
};

var layerControl = new CustomLayerControl(baseMaps, overlayMaps).addTo(map);

map.on('overlayadd', onOverlayAdd);
map.on('overlayremove', onOverlayRemove);

// Recalculer la position lors des événements de carte
function refreshSplit() {
    if (map.hasLayer(orthophoto2020) && map.hasLayer(orthophoto2025)) {
        updateSplitPosition(splitPosition);
    }
}

window.addEventListener('resize', refreshSplit);
window.addEventListener('scroll', refreshSplit);
map.on('moveend', refreshSplit);
map.on('zoomend', refreshSplit);
map.on('move', refreshSplit);

function switchRegion() {
    alert("Fonctionnalité de changement de région à implémenter");
}



// ---------------------------- Sélection des couches et des graphiques -------------------------------------

// Fonction d'import des geojson
async function loadGeoJSON(dataLink) {
  const response = await fetch(dataLink);
  const geojson = await response.json();
  return geojson;
}

let geojsonFeature;

//Fonction asynchrone pour que les données s'affiche bien
(async () => {
  geojsonFeature = await loadGeoJSON('data/lcz_web_aix_wgs84.geojson');
})();



//Fonction pour supprimer les couches déjà affichées
function removeLayers(){
    if (typeof geojsonLCZ !== 'undefined' && map.hasLayer(geojsonLCZ)) {
        map.removeLayer(geojsonLCZ);
    }
    if (typeof geojsonAspRatio !== 'undefined' && map.hasLayer(geojsonAspRatio)) {
        map.removeLayer(geojsonAspRatio);
    }
    if (typeof geojsonBati !== 'undefined' && map.hasLayer(geojsonBati)) {
        map.removeLayer(geojsonBati);
    }
    if (typeof geojsonImpermeable !== 'undefined' && map.hasLayer(geojsonImpermeable)) {
        map.removeLayer(geojsonImpermeable);
    }
    if (typeof geojsonPermeable !== 'undefined' && map.hasLayer(geojsonPermeable)) {
        map.removeLayer(geojsonPermeable);
    }
    if (typeof geojsonHautMoy !== 'undefined' && map.hasLayer(geojsonHautMoy)) {
        map.removeLayer(geojsonHautMoy);
    }
    if (typeof geojsonRugosite !== 'undefined' && map.hasLayer(geojsonRugosite)) {
        map.removeLayer(geojsonRugosite);
    }
    if (typeof geojsonMoySVF !== 'undefined' && map.hasLayer(geojsonMoySVF)) {
        map.removeLayer(geojsonMoySVF);
    }
    if (typeof geojsonVegetation !== 'undefined' && map.hasLayer(geojsonVegetation)) {
        map.removeLayer(geojsonVegetation);
    }
    if (typeof geojsonICU !== 'undefined' && map.hasLayer(geojsonICU)) {
        map.removeLayer(geojsonICU);
    }
    if (typeof geojsonfiltre !== 'undefined' && map.hasLayer(geojsonfiltre)) {
        map.removeLayer(geojsonfiltre);
    }
};

//Disable le bouton cliqué et disable les autres + couche active pour les filtres
coucheActive = '';
function ableButton(buttonName){
    document.getElementById("coucheLCZ").disabled = false;
    document.getElementById("coucheAspRatio").disabled = false;
    document.getElementById("coucheBati").disabled = false;
    document.getElementById("coucheImpermeable").disabled = false;
    document.getElementById("couchePermeable").disabled = false;
    document.getElementById("coucheHauteurMoy").disabled = false;
    document.getElementById("coucheRugosite").disabled = false;
    document.getElementById("coucheMoySVF").disabled = false;
    document.getElementById("coucheVegetation").disabled = false;
    document.getElementById("coucheICU").disabled = false;

    document.getElementById(buttonName).disabled = true;

    coucheActive = buttonName;
};


// -------------------------------- Affichage des données -------------------------

// Fonctionnalités pour toutes les couches
// FONCTIONNALITÉ 4: Popup d'information au clic
function showFeatureInfo(e) {
    let feature = e.target.feature;
    let props = feature.properties;
    
    let content = '<div class="info-popup"><h4>Informations</h4><table>';
    // Création de l'objet pour rendre les noms lisibles
    let nomClair = {"id": "Identifiant",
        "lcz_type": "Type de LCZ",
        "lcz_label": "Description LCZ",
        "aspect_ratio": "Aspect ratio",
        "pct_batiment": "Pourcentage de bâti",
        "pct_impermeable": "Pourcentage surface imperméable",
        "pct_permeable": "Pourcentage surface perméable",
        "hauteur_moy_batiment": "Hauteur moyenne des bâtiments",
        "hauteur_moy_rugosite": "Hauteur moyenne de la rugosité",
        "moy_svf": "Sky View factor moyen",
        "icu_index": "Index Îlot de Chaleur Urbain",
        "pct_vegetation": "Pourcentage de végétation",
        "icu_label": "Potentiel îlot de chaleur urbain"
    }
    for (let key in props) {
        if (props.hasOwnProperty(key) && props[key] !== null) {
            content += '<tr><td>' + nomClair[key] + '</td><td>' + props[key] + '</td></tr>';
        }
    }
    
    content += '</table></div>';
    
    e.target.bindPopup(content).openPopup();
};

// Configuration des événements pour chaque feature
function onEachFeature(feature, layer) {
    layer.on({
        click: showFeatureInfo
    });
};



//Afficher les données filtrées
function donneesFiltrer(coucheActive, labelFiltre){
    removeLayers();

    //{nom du bouton cliqué : [fonction affichage de la couche, fonction du style de la couche, nom de la colonne de la couche]}
    referenceDonnees = {"coucheLCZ" : [afficheLCZ, styleLCZ, "lcz_type"],
        "coucheAspRatio" : [afficheAspRatio, styleAspRatio, "aspect_ratio"],
        "coucheBati" : [afficheBati, styleBati, "pct_batiment"],
        "coucheImpermeable" : [afficheImpermeable, styleImpermeable, "pct_impermeable"],
        "couchePermeable" : [affichePermeable, stylePermeable, "pct_permeable"],
        "coucheHauteurMoy" : [afficheHautMoy, styleHautMoy, "hauteur_moy_batiment"],
        "coucheRugosite" : [afficheRugosite, styleRugosite, "hauteur_moy_rugosite"],
        "coucheMoySVF" : [afficheMoySVF, styleMoySVF, "moy_svf"],
        "coucheVegetation" : [afficheVegetation, styleVegetation, "pct_vegetation"],
        "coucheICU" : [afficheICU, styleICU, "icu_index"]
    };
    //Si le filtre était déjà sélectionné, on réinitialise la couche
    if(document.getElementById("filtreActif").innerHTML === labelFiltre){
        //On recharge la couche en appellant la fonction
        referenceDonnees[coucheActive][0].call();
        
    //Si le filtre n'était pas déjà sélectionné, on affiche la couche filtrée
    }else{
        //Affichage du filtre activé sur la page web
        document.getElementById("filtreActif").innerHTML = labelFiltre;
        colData = referenceDonnees[coucheActive][2];
        //https://stackoverflow.com/questions/53250709/openlayers-create-layers-from-geojson-by-property
        if (coucheActive === "coucheLCZ" || coucheActive === "coucheICU"){
            filteredData = {
                "type": "FeatureCollection",
                "features": geojsonFeature.features.filter(function(features){
                    return (features.properties[colData] == labelFiltre);
                })
            };
        }else {
            console.log(labelFiltre)
            // On filtre les indicateurs par rapport au minimum et au maximum de la barre du graphique sélectionnée
            filteredData = {
                "type": "FeatureCollection",
                "features": geojsonFeature.features.filter(function(features){
                    return (features.properties[colData] >= parseFloat(labelFiltre.split(' - ')[0]) && features.properties[colData] < parseFloat(labelFiltre.split(' - ')[1]));
                })
            };
        };
        //On affiche la couche
        geojsonfiltre = L.geoJSON(filteredData, {
            style: referenceDonnees[coucheActive][1],
            onEachFeature: onEachFeature
        }).addTo(map);
    };
};



// Couche LCZ
document.getElementById("coucheLCZ").addEventListener("click", afficheLCZ);

// Chargement des données GeoJSON
let geojsonLCZ;
const texteLCZ = "<img class='img-fluid' src='images/SchemaLCZ.png' alt='Schéma explicatif des LCZ'>";

function afficheLCZ(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des LCZ
    document.getElementById("informationsActif").innerHTML = texteLCZ;
    //On bloque le bouton
    ableButton("coucheLCZ");
    //On créer le graphique
    couleurLegende = ['#f49197', '#f5e960', '#b9b0fb', '#55d6c2', '#705e78', '#d9d9d9', '#9fd356', '#c2ff67', '#f2b980', '#90cbfb'];
    creerGraphiqueBar(geojsonFeature.features.map(f => f.properties.lcz_type), couleurLegende);
    //On affiche la couche
    geojsonLCZ = L.geoJSON(geojsonFeature, {
        style: styleLCZ,
        onEachFeature: onEachFeature
    }).addTo(map);
};


// Fonction de couleur pour les LCZ
function getColorLCZ(label) {
    if (label === "LCZ 2"){
        return '#f49197';
    }else if (label === "LCZ 3"){
        return '#f5e960';
    }else if (label === "LCZ 5"){
        return '#b9b0fb';
    }else if (label === "LCZ 6"){
        return '#55d6c2';
    }else if (label === "LCZ 8"){
        return '#705e78';
    }else if (label === "LCZ 9"){
        return '#d9d9d9';
    }else if (label === "LCZ B"){
        return '#9fd356';
    }else if (label === "LCZ D"){
        return '#c2ff67';
    }else if (label === "LCZ E"){
        return '#f2b980';
    }else if (label === "LCZ G"){
        return '#90cbfb';
    }else {
        return '#232323';
    };
};


// Style des features GeoJSON
function styleLCZ(feature) {
    return {
        fillColor: getColorLCZ(feature.properties.lcz_type),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};




//Affichage Indicateur aspect ratio

document.getElementById("coucheAspRatio").addEventListener("click", afficheAspRatio);

// Chargement de la couche GeoJSON
let geojsonAspRatio;
function afficheAspRatio(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Rapport hauteur/ largeur du canyon urbain moyen <br><table><tr><td>0 à 0,10</td><td>Très ouvert, rural</td></tr><tr><td>0,10 à 0,35</td><td>Ouvert, suburbain</td></tr><tr><td>0,35 à 0,75</td><td>Semi-compact</td></tr><tr><td>0,75 et +</td><td>Canyon compact</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheAspRatio");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.aspect_ratio), [0.10, 0.35, 0.75, 1], ['#FFF7BC', '#FEC44F', '#D95F0E', '#7F0000']);
    //On affiche la couche
    geojsonAspRatio = L.geoJSON(geojsonFeature, {
        style: styleAspRatio,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les aspect ratio
function getColorAspRatio(label) {
    if (label<0.10){
        return '#FFF7BC';
    }else if (label<0.35){
        return '#FEC44F';
    }else if (label<0.75){
        return '#D95F0E';
    }else {
        return '#7F0000';
    };
};

// Style des features GeoJSON
function styleAspRatio(feature) {
    return {
        fillColor: getColorAspRatio(feature.properties.aspect_ratio),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};



//Affichage Indicateur pourcentage de bâti

document.getElementById("coucheBati").addEventListener("click", afficheBati);

// Chargement de la couche GeoJSON
let geojsonBati;
function afficheBati(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Pourcentage de l'emprise au sol du bâti";
    //On bloque le bouton
    ableButton("coucheBati");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.pct_batiment), [10, 20, 30, 40, 100], ['#FFFFD4', '#FED98E', '#FE9929', '#D95F0E', '#662506']);
    //On affiche la couche
    geojsonBati = L.geoJSON(geojsonFeature, {
        style: styleBati,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les Bati
function getColorBati(label) {
    if (label<10){
        return '#FFFFD4';
    }else if (label<20){
        return '#FED98E';
    }else if (label<30){
        return '#FE9929';
    }else if (label<40){
        return '#D95F0E';
    }else {
        return '#662506';
    };
};

// Style des features GeoJSON
function styleBati(feature) {
    return {
        fillColor: getColorBati(feature.properties.pct_batiment),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur pourcentage de Impermeable

document.getElementById("coucheImpermeable").addEventListener("click", afficheImpermeable);

// Chargement de la couche GeoJSON
let geojsonImpermeable;
function afficheImpermeable(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Pourcentage de la zone imperméable <br><table><tr><td>0 à 20</td><td>Naturel/végétalisé</td></tr><tr><td>20 à 40</td><td>Péri-urbain mixte</td></tr><tr><td>40 à 60</td><td>Suburbain</td></tr><tr><td>60 à 80</td><td>Urbain dense</td></tr><tr><td>80 à 100</td><td>Très imperméable</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheImpermeable");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.pct_impermeable), [20, 40, 60, 80, 100], ['#EDF8E9', '#238B45', '#FEC44F', '#D94801', '#67000D']);
    //On affiche la couche
    geojsonImpermeable = L.geoJSON(geojsonFeature, {
        style: styleImpermeable,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les Impermeable
function getColorImpermeable(label) {
    if (label<20){
        return '#EDF8E9';
    }else if (label<40){
        return '#238B45';
    }else if (label<60){
        return '#FEC44F';
    }else if (label<80){
        return '#D94801';
    }else {
        return '#67000D';
    };
};

// Style des features GeoJSON
function styleImpermeable(feature) {
    return {
        fillColor: getColorImpermeable(feature.properties.pct_impermeable),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur pourcentage de Permeable

document.getElementById("couchePermeable").addEventListener("click", affichePermeable);

// Chargement de la couche GeoJSON
let geojsonPermeable;
function affichePermeable(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Pourcentage de la zone perméable <br><table><tr><td>0 à 20</td><td>Très imperméable</td></tr><tr><td>20 à 40</td><td>Urbain dense</td></tr><tr><td>40 à 60</td><td>Suburbain</td></tr><tr><td>60 à 80</td><td>Péri-urbain mixte</td></tr><tr><td>80 à 100</td><td>Naturel/végétalisé</td></tr></table>";
    //On bloque le bouton
    ableButton("couchePermeable");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.pct_permeable), [20, 40, 60, 80, 100], ['#67000D', '#D94801', '#FEC44F', '#238B45', '#EDF8E9']);
    //On affiche la couche
    geojsonPermeable = L.geoJSON(geojsonFeature, {
        style: stylePermeable,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les Permeable
function getColorPermeable(label) {
    if (label<20){
        return '#67000D';
    }else if (label<40){
        return '#D94801';
    }else if (label<60){
        return '#FEC44F';
    }else if (label<80){
        return '#238B45';
    }else {
        return '#EDF8E9';
    };
};

// Style des features GeoJSON
function stylePermeable(feature) {
    return {
        fillColor: getColorPermeable(feature.properties.pct_permeable),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur pourcentage de HautMoy

document.getElementById("coucheHauteurMoy").addEventListener("click", afficheHautMoy);

// Chargement de la couche GeoJSON
let geojsonHautMoy;
function afficheHautMoy(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Hauteur moyenne des bâtiments <br><table><tr><td>0 à 3</td><td>Très faible/hangar</td></tr><tr><td>3 à 6</td><td>Faible (R+0 / R+1)</td></tr><tr><td>6 à 10</td><td>Moyen (R+2)</td></tr><tr><td>10 à 15</td><td>Mi-hauteur (R+3/R+4)</td></tr><tr><td>15 à 50</td><td>Elevé</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheHauteurMoy");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.hauteur_moy_batiment), [3, 6, 10, 15, 50], ['#F7FBFF', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B']);
    //On affiche la couche
    geojsonHautMoy = L.geoJSON(geojsonFeature, {
        style: styleHautMoy,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les HautMoy
function getColorHautMoy(label) {
    if (label<3){
        return '#F7FBFF';
    }else if (label<6){
        return '#C6DBEF';
    }else if (label<10){
        return '#6BAED6';
    }else if (label<15){
        return '#2171B5';
    }else {
        return '#08306B';
    };
};

// Style des features GeoJSON
function styleHautMoy(feature) {
    return {
        fillColor: getColorHautMoy(feature.properties.hauteur_moy_batiment),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur pourcentage de Rugosite

document.getElementById("coucheRugosite").addEventListener("click", afficheRugosite);

// Chargement de la couche GeoJSON
let geojsonRugosite;
function afficheRugosite(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Hauteur aérodynamique du couvert urbain <br><table><tr><td>0 à 1</td><td>Très lisse / plat</td></tr><tr><td>1 à 2,5</td><td>Faible rugosité (épars)</td></tr><tr><td>2,5 à 5</td><td>Modérée (suburbain)</td></tr><tr><td>5 à 10</td><td>Forte (dense)</td></tr><tr><td>10 à 30</td><td>Très rugueuse (cœur urb.)</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheRugosite");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.hauteur_moy_rugosite), [1, 2.5, 5, 10, 30], ['#FFF5EB', '#FDD0A2', '#FD8D3C', '#D94801', '#7F2704']);
    //On affiche la couche
    geojsonRugosite = L.geoJSON(geojsonFeature, {
        style: styleRugosite,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les Rugosite
function getColorRugosite(label) {
    if (label<1){
        return '#FFF5EB';
    }else if (label<2.5){
        return '#FDD0A2';
    }else if (label<5){
        return '#FD8D3C';
    }else if (label<10){
        return '#D94801';
    }else {
        return '#7F2704';
    };
};

// Style des features GeoJSON
function styleRugosite(feature) {
    return {
        fillColor: getColorRugosite(feature.properties.hauteur_moy_rugosite),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur moyenne de Sky view factor

document.getElementById("coucheMoySVF").addEventListener("click", afficheMoySVF);

// Chargement de la couche GeoJSON
let geojsonMoySVF;
function afficheMoySVF(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Fraction du ciel visible depuis le sol <br><table><tr><td>0 à 0,65</td><td>Canyon dense</td></tr><tr><td>0,65 à 0,75</td><td>Semi-ouvert</td></tr><tr><td>0,75 à 0,9</td><td>Suburbain ouvert</td></tr><tr><td>0,9 à 1</td><td>Rural / très ouvert</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheMoySVF");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.moy_svf), [0.65, 0.75, 0.9, 1], ['#4D004B', '#88419D', '#B3CDE3', '#FEF9D9']);
    //On affiche la couche
    geojsonMoySVF = L.geoJSON(geojsonFeature, {
        style: styleMoySVF,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les MoySVF
function getColorMoySVF(label) {
    if (label<0.65){
        return '#4D004B';
    }else if (label<0.75){
        return '#88419D';
    }else if (label<0.90){
        return '#B3CDE3';
    }else {
        return '#FEF9D9';
    };
};

// Style des features GeoJSON
function styleMoySVF(feature) {
    return {
        fillColor: getColorMoySVF(feature.properties.moy_svf),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};



//Affichage Indicateur moyenne de Végétation

document.getElementById("coucheVegetation").addEventListener("click", afficheVegetation);

// Chargement de la couche GeoJSON
let geojsonVegetation;
function afficheVegetation(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Pourcentage de la surface couverte par de la végétation (canopée + végétation basse) <br><table><tr><td>0 à 20</td><td>Très peu végétalisé</td></tr><tr><td>20 à 40</td><td>Peu végétalisé</td></tr><tr><td>40 à 60</td><td>Modérément végétalisé</td></tr><tr><td>60 à 80</td><td>Bien végétalisé</td></tr><tr><td>80 à 100</td><td>Dominant végétal</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheVegetation");
    //On créer le graphique
    creerGraphiqueBarSeuil(geojsonFeature.features.map(f => f.properties.pct_vegetation), [20, 40, 60, 80, 100], ['#EDF8E9', '#74C476', '#31A354', '#006D2C', '#00280F']);
    //On affiche la couche
    geojsonVegetation = L.geoJSON(geojsonFeature, {
        style: styleVegetation,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les Vegetation
function getColorVegetation(label) {
    if (label<20){
        return '#EDF8E9';
    }else if (label<40){
        return '#74C476';
    }else if (label<60){
        return '#31A354';
    }else if (label<80){
        return '#006D2C';
    }else {
        return '#00280F';
    };
};

// Style des features GeoJSON
function styleVegetation(feature) {
    return {
        fillColor: getColorVegetation(feature.properties.pct_vegetation),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


//Affichage Indicateur ICU

document.getElementById("coucheICU").addEventListener("click", afficheICU);

// Chargement de la couche GeoJSON
let geojsonICU;
function afficheICU(){
    //On enlève les couches
    removeLayers();
    //Affichage du filtre activé sur la page web
    document.getElementById("filtreActif").innerHTML = "Aucun";
    //Affichage d'un texte d'informations sur des indicateur
    document.getElementById("informationsActif").innerHTML = "Indice synthétique du potentiel d'îlot de chaleur urbain <br><table><tr><td>1</td><td>Potentiel ICU très faible</td></tr><tr><td>2</td><td>Potentiel ICU faible</td></tr><tr><td>3</td><td>Potentiel ICU moyen</td></tr><tr><td>4</td><td>Potentiel ICU élevé</td></tr><tr><td>5</td><td>Potentiel ICU très élevé</td></tr></table>";
    //On bloque le bouton
    ableButton("coucheICU");
    //On créer le graphique
    creerGraphiqueBar(geojsonFeature.features.map(f => f.properties.icu_index), ['#2166AC', '#92C5DE', '#F7F7F7', '#F4A582', '#B2182B']);
    //On affiche la couche
    geojsonICU = L.geoJSON(geojsonFeature, {
        style: styleICU,
        onEachFeature: onEachFeature
    }).addTo(map);
};

// Fonction de couleur pour les ICU
function getColorICU(label) {
    if (label==1){
        return '#2166AC';
    }else if (label==2){
        return '#92C5DE';
    }else if (label==3){
        return '#F7F7F7';
    }else if (label==4){
        return '#F4A582';
    }else {
        return '#B2182B';
    };
};

// Style des features GeoJSON
function styleICU(feature) {
    return {
        fillColor: getColorICU(feature.properties.icu_index),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.8
    };
};


// ------------------------------------- Affichage des graphiques ---------------------------------------
//Initialisation du graphique
let ctx = document.getElementById('geoChart').getContext('2d');
let chart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
        data: [],
        borderWidth: 1,
        backgroundColor: []
        }]
    },
    options: {
        plugins:{
            legend: {
                display: false
            }
        },
        responsive: true,
        scales: {
        y: { beginAtZero: true }
        },
        //https://stackoverflow.com/questions/72330662/how-to-add-on-click-event-to-chart-js
        //https://www.chartjs.org/docs/latest/configuration/interactions.html
        onClick: (event, elements) => {
            i = elements[0].index;
            donneesFiltrer(coucheActive, event.chart.data.labels[i]);
        }
    }
    });


// Graphique LCZ
function creerGraphiqueBar(listAttributs, couleurLegende){
    nomAttribut = [];
    nbAttribut = [];
    for (let i = 0; i < listAttributs.length; i++){
        if (nomAttribut.includes(listAttributs[i]) === true) {
            index = nomAttribut.indexOf(listAttributs[i]);
            nbAttribut[index] = nbAttribut[index] + 1;
        } else {
            nomAttribut.push(listAttributs[i]);
            //Pour que la légende du graphique soit trier
            nomAttribut.sort();
            index = nomAttribut.indexOf(listAttributs[i]);
            nbAttribut.splice(index, 0, 1);
        }
    }
    
    //Modification du graphique
    //doc : https://www.geeksforgeeks.org/javascript/how-to-dynamically-update-values-of-a-chart-in-chartjs/
    chart.data.labels = nomAttribut;
    chart.data.datasets[0].data = nbAttribut;
    chart.data.datasets[0].backgroundColor = couleurLegende;
    chart.update();
};

// Graphique indicateurs
function creerGraphiqueBarSeuil(listAttributs, listSeuil, couleurLegende){
    // Liste des seuils pour la légende
    nomAttribut = [];
    nbAttribut = [];
    for (let i = 0; i < listSeuil.length; i++){
        if (i === 0){
            nomAttribut.push("0 - " + listSeuil[i]);
        } else {
            nomAttribut.push(listSeuil[i-1] + ' - ' + listSeuil[i]);
        }
        // On met le nombre d'attribut à 0 pour chaque seuil
        nbAttribut.push(0);
    }

    // On incrémente de 1 le seuil pour chaque nombre qui rentre dans le seuil
    for (let i = 0; i < listAttributs.length; i++){
        let j = 0;
        while (listAttributs[i] > listSeuil[j]){
            j++
        }
        nbAttribut[j] = nbAttribut[j] + 1;
    }

    //Modification du graphique
    //doc : https://www.geeksforgeeks.org/javascript/how-to-dynamically-update-values-of-a-chart-in-chartjs/
    chart.data.labels = nomAttribut;
    chart.data.datasets[0].data = nbAttribut;
    chart.data.datasets[0].backgroundColor = couleurLegende;
    chart.update();
};

