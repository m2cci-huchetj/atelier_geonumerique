// Mode plein écran
function toggleFullscreen() {
    var elem = document.getElementById('main-content');
    
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Mettre à jour le texte du bouton plein écran
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('msfullscreenchange', updateFullscreenButton);

function updateFullscreenButton() {
    var btn = document.querySelector('.fullscreen-btn');
    if (document.fullscreenElement) {
        btn.textContent = '✗ Quitter plein écran';
    } else {
        btn.textContent = '⛶ Plein écran';
    }
}