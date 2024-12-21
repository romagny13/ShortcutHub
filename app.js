import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
let currentUser = null; // Variable pour stocker l'utilisateur actuel
let urlChangedOnce = false; // Variable pour suivre le changement du champ URL
let shortcuts = [];
let isGridView = true; // Set default to grid view

// Sélectionner les éléments du DOM
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const shortcutsContainer = document.getElementById("shortcutsContainer");
const viewToggleButton = document.getElementById("viewToggle");
const viewIcon = document.getElementById("viewIcon");
const addShortcutButton = document.getElementById("addShortcut");
const addPopup = document.getElementById("addPopup");
const addForm = document.getElementById("addForm");
const urlInput = document.getElementById("url");
const nameInput = document.getElementById("name");
const clearShortcutsButton = document.getElementById("clearShortcuts");

loginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Utilisateur connecté : ", user.displayName);
    currentUser = user; // Sauvegarder l'utilisateur connecté
    updateUI(user);
  } catch (error) {
    console.error("Erreur d'authentification : ", error.message);
  }
});

// Fonction de déconnexion
logoutBtn.addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("Utilisateur déconnecté");
      currentUser = null; // Réinitialiser l'utilisateur lorsque déconnecté
      updateUI(user);
    })
    .catch((error) => {
      console.error("Erreur de déconnexion : ", error.message);
    });
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Utilisateur connecté : ", user.displayName);
    currentUser = user; // Sauvegarder l'utilisateur
    updateUI(user);
    loadShortcuts().then((s) => {
      shortcuts = s;
      displayShortcuts();
    });
  } else {
    console.log("Aucun utilisateur connecté");
    currentUser = null; // Réinitialiser l'utilisateur lorsque déconnecté
    updateUI(null);
  }
});

// Fonction pour afficher les éléments selon l'état de l'utilisateur
function updateUI(user) {
  if (user) {
    // Utilisateur connecté : afficher message de bienvenue et bouton logout
    userInfo.classList.remove("hidden");
    loginBtn.classList.add("hidden");
  } else {
    // Utilisateur déconnecté : afficher bouton login
    userInfo.classList.add("hidden");
    loginBtn.classList.remove("hidden");
  }
}

// Sauvegarder les raccourcis dans Firestore
async function saveShortcutsToFirestore(userId, shortcuts) {
  const userRef = doc(db, "users", userId);

  try {
    // Vérifier si l'utilisateur a déjà un document dans Firestore
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      // Si le document existe déjà, mettre à jour les raccourcis et la date de modification
      await updateDoc(userRef, {
        shortcuts: arrayUnion(...shortcuts),
        lastModified: serverTimestamp(), // Mettre à jour la date
      });
      console.log("Raccourcis mis à jour avec la date de modification !");
    } else {
      // Si l'utilisateur n'a pas de document, créer un nouveau document avec les raccourcis et la date
      await setDoc(userRef, {
        shortcuts: shortcuts,
        lastModified: serverTimestamp(), // Ajouter la date de modification
      });
      console.log("Raccourcis enregistrés avec la date de modification !");
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des raccourcis : ", error);
  }
}

// Charger les raccourcis depuis Firestore
async function loadShortcutsFromFirestore(userId) {
  const userRef = doc(db, "users", userId);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log("Raccourcis de l'utilisateur : ", data.shortcuts);
      console.log("Date de dernière modification : ", data.lastModified);
      return data;
    } else {
      console.log("Aucun raccourci trouvé pour cet utilisateur.");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des raccourcis : ", error);
  }
}

async function loadShortcuts() {
  let shortcuts = JSON.parse(localStorage.getItem("shortcuts")) || [];

  if (currentUser) {
    let firestoreShortcuts = await loadShortcutsFromFirestore(currentUser.uid);

    if (firestoreShortcuts) {
      const localDate = new Date(localStorage.getItem("lastModified"));
      const firestoreDate = firestoreShortcuts.lastModified.toDate();

      if (localDate.getTime() < firestoreDate.getTime()) {
        // Si la date locale est plus ancienne, synchronise avec Firestore
        localStorage.setItem(
          "shortcuts",
          JSON.stringify(firestoreShortcuts.shortcuts)
        );
        return firestoreShortcuts.shortcuts;
      } else {
        // Si la date locale est plus récente, envoie vers Firestore
        saveShortcutsToFirestore(currentUser.uid, shortcuts);
        return shortcuts;
      }
    }
  }

  return shortcuts;
}

async function saveShortcuts() {
  if (currentUser) {
    await saveShortcutsToFirestore(currentUser.uid, shortcuts);
  }

  localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
  const currentDate = new Date(); // Crée une nouvelle instance de la date actuelle
  localStorage.setItem("lastModified", currentDate.toISOString());
}

function getIconForUrl(url) {
  const mappings = [
    {
      domain: ["youtube.com", "youtu.be"],
      icon: `<i class="fab fa-youtube text-red-500"></i>`,
    },
    {
      domain: ["tiktok.com"],
      icon: `<i class="fab fa-tiktok text-black"></i>`,
    },
    {
      domain: ["instagram.com"],
      icon: `<i class="fab fa-instagram text-pink-500"></i>`,
    },
    {
      domain: ["twitter.com", "x.com"],
      icon: `<i class="fab fa-twitter text-blue-400"></i>`,
    },
    {
      domain: ["facebook.com"],
      icon: `<i class="fab fa-facebook text-blue-700"></i>`,
    },
    {
      domain: ["linkedin.com"],
      icon: `<i class="fab fa-linkedin text-blue-500"></i>`,
    },
    {
      domain: ["dailymotion.com"],
      icon: `<i class="fab fa-dailymotion text-blue-600"></i>`,
    },
    {
      domain: ["pinterest.com"],
      icon: `<i class="fab fa-pinterest text-red-600"></i>`,
    },
    {
      domain: ["reddit.com"],
      icon: `<i class="fab fa-reddit text-orange-500"></i>`,
    },
    {
      domain: ["tumblr.com"],
      icon: `<i class="fab fa-tumblr text-blue-600"></i>`,
    },
    {
      domain: ["snapchat.com"],
      icon: `<i class="fab fa-snapchat text-yellow-500"></i>`,
    },
    {
      domain: ["twitch.tv"],
      icon: `<i class="fab fa-twitch text-purple-500"></i>`,
    },
    {
      domain: ["vimeo.com"],
      icon: `<i class="fab fa-vimeo text-blue-400"></i>`,
    },
    {
      domain: ["spotify.com"],
      icon: `<i class="fab fa-spotify text-green-500"></i>`,
    },
    {
      domain: ["github.com"],
      icon: `<i class="fab fa-github text-gray-600"></i>`,
    },
    {
      domain: ["stackoverflow.com"],
      icon: `<i class="fab fa-stack-overflow text-orange-500"></i>`,
    },
    {
      domain: ["medium.com"],
      icon: `<i class="fab fa-medium text-black"></i>`,
    },
  ];

  // Parcours des mappages pour trouver une correspondance
  for (const mapping of mappings) {
    if (mapping.domain.some((d) => url.includes(d))) {
      return mapping.icon;
    }
  }

  // Icône par défaut si aucune correspondance
  return `<i class="fas fa-link text-gray-500"></i>`;
}

function displayShortcuts() {
  shortcutsContainer.innerHTML = "";

  const layoutClass = isGridView
    ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
    : "flex flex-col gap-2";
  shortcutsContainer.className = layoutClass;

  shortcuts.forEach((shortcut, index) => {
    const div = document.createElement("div");
    div.setAttribute("draggable", true); // Ajout du glisser-déposer
    div.setAttribute("data-index", index); // Identifiant pour le glisser-déposer

    if (isGridView) {
      const icon = getIconForUrl(shortcut.url);
      div.className =
        "glassmorphism p-6 rounded-2xl card-hover group relative shortcut-item";
      div.innerHTML = `
  <div class="flex justify-between items-start mb-3">
      <h3 class="text-xl font-bold gradient-text truncate" style="max-width: 200px;">
          ${shortcut.name}
      </h3>
      <button class="delete-button text-gray-400 hover:text-red-400 transition-colors duration-300 delete-btn" data-index="${index}">
          <i class="fas fa-times"></i>
      </button>
  </div>
  <a href="${shortcut.url}" target="_blank" class="text-pink-300 hover:text-pink-400 transition duration-300 block break-words hover:underline flex items-center gap-2">
      ${icon} <span class="truncate">${shortcut.url}</span>
  </a>
`;
    } else {
      div.className =
        "glassmorphism rounded-xl card-hover group relative list-view-item shortcut-item";
      div.innerHTML = `
  <button class="delete-button text-gray-400 hover:text-red-400 transition-colors duration-300 delete-btn" data-index="${index}">
      <i class="fas fa-times"></i>
  </button>
  <h3 class="text-sm font-bold gradient-text truncate" style="max-width: 200px;">
      ${shortcut.name}
  </h3>
  <a href="${shortcut.url}" target="_blank" class="text-pink-300 hover:text-pink-400 transition duration-300 truncate hover:underline flex-1">
      ${shortcut.url}
  </a>
`;
    }

    shortcutsContainer.appendChild(div);

    // Ajout des événements pour le drag-and-drop
    div.addEventListener("dragstart", handleDragStart);
    div.addEventListener("dragover", handleDragOver);
    div.addEventListener("drop", handleDrop);
    div.addEventListener("dragenter", handleDragEnter);
    div.addEventListener("dragleave", handleDragLeave);
  });

  const deleteButtons = document.querySelectorAll(".delete-button");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = button.getAttribute("data-index");
      shortcuts.splice(index, 1);
      localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
      displayShortcuts();
    });
  });

  // Mise à jour de l'icône de vue
  viewIcon.className = isGridView ? "fas fa-th-list" : "fas fa-th";
}

// Gestion du début du drag
function handleDragStart(event) {
  event.dataTransfer.setData("text/plain", event.target.dataset.index);
  event.target.classList.add("dragging"); // Ajouter une classe pour l'indicateur visuel
}

// Gestion du survol (dragover)
function handleDragOver(event) {
  event.preventDefault(); // Nécessaire pour autoriser le drop
}

// Gestion du début de l'entrée d'un élément dans la zone de drop
function handleDragEnter(event) {
  const target = event.target.closest(".shortcut-item");
  if (target && !target.classList.contains("dragging")) {
    target.classList.add("drag-over"); // Ajouter un effet visuel sur la cible
  }
}

// Gestion de la sortie d'un élément de la zone de drop
function handleDragLeave(event) {
  const target = event.target.closest(".shortcut-item");
  if (target) {
    target.classList.remove("drag-over"); // Retirer l'effet visuel
  }
}

// Gestion du drop
async function handleDrop(event) {
  event.preventDefault();
  const target = event.target.closest(".shortcut-item");
  if (target) {
    target.classList.remove("drag-over"); // Retirer l'effet visuel
  }

  const draggedIndex = event.dataTransfer.getData("text/plain");
  const droppedIndex = target.dataset.index;

  // Réorganiser les éléments dans le tableau
  const draggedItem = shortcuts.splice(draggedIndex, 1)[0];
  shortcuts.splice(droppedIndex, 0, draggedItem);

  // Sauvegarder dans localStorage et redéfinir l'affichage
 await saveShortcuts();
  displayShortcuts();
}

function openPopup() {
  urlChangedOnce = false;
  urlInput.value = "";
  nameInput.value = "";
  addPopup.classList.remove("hidden");
  setTimeout(() => {
    nameInput.focus();
  }, 0);
}

function closePopup() {
  addPopup.classList.add("hidden");
}

addForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const name = document.getElementById("name").value;
  const url = document.getElementById("url").value;
  shortcuts.push({ name, url });
  await saveShortcuts();
  displayShortcuts();
  closePopup();
  addForm.reset();
});

addShortcutButton.addEventListener("click", openPopup);

clearShortcutsButton.addEventListener("click", async function () {
  shortcuts = [];
  await saveShortcuts();
  displayShortcuts();
});

viewToggleButton.addEventListener("click", function () {
  isGridView = !isGridView;
  displayShortcuts();
});

urlInput.addEventListener("input", function () {
  const urlValue = this.value;
  if (!urlChangedOnce && urlValue && nameInput.value === "") {
    // Lorsque le champ URL est modifié pour la première fois, on copie la valeur dans 'name'
    nameInput.value = urlValue;
    urlChangedOnce = true; // Marquer que le champ a été modifié une fois
  }
});

loadShortcuts().then((s) => {
  shortcuts = s;
  displayShortcuts();
});
