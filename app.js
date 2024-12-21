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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
let currentUser = null;
let urlChangedOnce = false;
let shortcuts = [];
let isGridView = true;

// Sélectionner les éléments du DOM
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const shortcutsContainer = document.getElementById("shortcutsContainer");
const viewToggleButton = document.getElementById("viewToggle");
const viewIcon = document.getElementById("viewIcon");
const addShortcutBtn = document.getElementById("addShortcut");
const addPopup = document.getElementById("addPopup");
const closePopupBtn = document.getElementById("closePopupBtn");
const addForm = document.getElementById("addForm");
const urlInput = document.getElementById("url");
const nameInput = document.getElementById("name");
const clearShortcutsBtn = document.getElementById("clearShortcuts");

// Connexion de l'utilisateur avec Google
loginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    console.log("Utilisateur connecté :", currentUser.displayName);
    updateUI(currentUser);
  } catch (error) {
    console.error("Erreur d'authentification :", error);
    alert("Erreur lors de la connexion. Veuillez réessayer.");
  }
});

// Déconnexion de l'utilisateur
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    console.log("Utilisateur déconnecté");
    currentUser = null;
    //shortcuts = [];
    updateUI(null);
    displayShortcuts();
  } catch (error) {
    console.error("Erreur de déconnexion :", error);
    alert("Erreur lors de la déconnexion. Veuillez réessayer.");
  }
});

// Surveiller l'état d'authentification de l'utilisateur
onAuthStateChanged(auth, async (user) => {
  try {
    if (user) {
      console.log("Utilisateur connecté :", user.displayName);
      currentUser = user;
      updateUI(user);
      shortcuts = await loadShortcuts();
      displayShortcuts();
    } else {
      console.log("Aucun utilisateur connecté");
      currentUser = null;
      updateUI(null);
      displayShortcuts();
    }
  } catch (error) {
    console.error(
      "Erreur lors du changement d'état d'authentification:",
      error
    );
  }
});

// Fonction pour afficher l'interface utilisateur selon l'état de l'utilisateur
function updateUI(user) {
  if (user) {
    userInfo.classList.remove("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    userInfo.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

// Sauvegarder les raccourcis dans Firestore
async function saveShortcutsToFirestore(userId, shortcuts) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);
  try {
    await setDoc(userRef, {
      shortcuts: shortcuts,
      lastModified: serverTimestamp(),
    });
    console.log("Raccourcis sauvegardés dans Firestore");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde Firestore:", error);
    throw error;
  }
}

// Charger les raccourcis depuis Firestore
async function loadShortcutsFromFirestore(userId) {
  if (!userId) return null;

  const userRef = doc(db, "users", userId);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        shortcuts: data.shortcuts || [],
        lastModified: data.lastModified,
      };
    }
    return null;
  } catch (error) {
    console.error("Erreur lors du chargement Firestore:", error);
    throw error;
  }
}

// Fonction unifiée pour sauvegarder les raccourcis
async function saveShortcuts() {
  try {
    if (currentUser) {
      await saveShortcutsToFirestore(currentUser.uid, shortcuts);
    }

    const currentDate = new Date().toISOString();
    localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
    localStorage.setItem("lastModified", currentDate);

    return true;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    throw error;
  }
}

async function loadShortcuts() {
  let shortcuts = JSON.parse(localStorage.getItem("shortcuts")) || [];

  if (currentUser) {
    let firestoreData = await loadShortcutsFromFirestore(currentUser.uid);

    if (firestoreData) {
      const localDate = new Date(localStorage.getItem("lastModified"));
      const firestoreDate = firestoreData.lastModified.toDate();

      if (localDate.getTime() < firestoreDate.getTime()) {
        localStorage.setItem(
          "shortcuts",
          JSON.stringify(firestoreData.shortcuts)
        );
        return firestoreData.shortcuts;
      } else {
        await saveShortcutsToFirestore(currentUser.uid, shortcuts);
        return shortcuts;
      }
    } else {
      await saveShortcutsToFirestore(currentUser.uid, shortcuts);
    }
  }

  return shortcuts;
}

// Fonction unifiée pour charger les raccourcis
// async function loadShortcuts() {
//   try {
//     let finalShortcuts = [];
//     const localShortcuts = JSON.parse(localStorage.getItem("shortcuts")) || [];
//     const localDate = localStorage.getItem("lastModified");

//     if (currentUser) {
//       const firestoreData = await loadShortcutsFromFirestore(currentUser.uid);

//       if (firestoreData) {
//         const firestoreDate = firestoreData.lastModified.toDate();

//         if (!localDate || new Date(localDate) < firestoreDate) {
//           finalShortcuts = firestoreData.shortcuts;
//           localStorage.setItem("shortcuts", JSON.stringify(finalShortcuts));
//           localStorage.setItem("lastModified", firestoreDate.toISOString());
//         } else {
//           finalShortcuts = localShortcuts;
//           await saveShortcutsToFirestore(currentUser.uid, localShortcuts);
//         }
//       } else {
//         finalShortcuts = localShortcuts;
//         if (localShortcuts.length > 0) {
//           await saveShortcutsToFirestore(currentUser.uid, localShortcuts);
//         }
//       }
//     } else {
//       finalShortcuts = localShortcuts;
//     }

//     return finalShortcuts;
//   } catch (error) {
//     console.error("Erreur lors du chargement des raccourcis:", error);
//     return JSON.parse(localStorage.getItem("shortcuts")) || [];
//   }
// }

// Fonction pour obtenir l'icône selon l'URL
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

  for (const mapping of mappings) {
    if (mapping.domain.some((d) => url.includes(d))) {
      return mapping.icon;
    }
  }

  return `<i class="fas fa-link text-gray-500"></i>`;
}

// Afficher les raccourcis dans l'interface utilisateur
function displayShortcuts() {
  try {
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
  </a>`;
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
  </a>`;
      }

      shortcutsContainer.appendChild(div);

      div.addEventListener("dragstart", handleDragStart);
      div.addEventListener("dragover", handleDragOver);
      div.addEventListener("drop", handleDrop);
      div.addEventListener("dragenter", handleDragEnter);
      div.addEventListener("dragleave", handleDragLeave);
    });

    const deleteButtons = document.querySelectorAll(".delete-button");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        try {
          const index = button.getAttribute("data-index");
          shortcuts.splice(index, 1);
          await saveShortcuts();
          displayShortcuts();
        } catch (error) {
          console.error("Erreur lors de la suppression:", error);
          alert("Erreur lors de la suppression. Veuillez réessayer.");
        }
      });
    });

    viewIcon.className = isGridView ? "fas fa-th-list" : "fas fa-th";
  } catch (error) {
    console.error("Erreur lors de l'affichage des raccourcis:", error);
    shortcutsContainer.innerHTML = `
      <div class="text-red-500 p-4">
        Une erreur est survenue lors de l'affichage des raccourcis.
        Veuillez rafraîchir la page.
      </div>
    `;
  }
}

// Gestion du drag and drop
async function handleDrop(event) {
  event.preventDefault();
  const target = event.target.closest(".shortcut-item");
  if (target) {
    target.classList.remove("drag-over");
  }

  try {
    const draggedIndex = parseInt(event.dataTransfer.getData("text/plain"));
    const droppedIndex = parseInt(target.dataset.index);

    if (
      !isNaN(draggedIndex) &&
      !isNaN(droppedIndex) &&
      draggedIndex !== droppedIndex
    ) {
      const draggedItem = shortcuts[draggedIndex];
      shortcuts.splice(draggedIndex, 1);
      shortcuts.splice(droppedIndex, 0, draggedItem);
      await saveShortcuts();
      displayShortcuts();
    }
  } catch (error) {
    console.error("Erreur lors du déplacement:", error);
    alert("Erreur lors du déplacement. Veuillez réessayer.");
  }
}

function handleDragStart(event) {
  event.dataTransfer.setData("text/plain", event.target.dataset.index);
  event.target.classList.add("dragging");
}

function handleDragOver(event) {
  event.preventDefault();
}

function handleDragEnter(event) {
  const target = event.target.closest(".shortcut-item");
  if (target && !target.classList.contains("dragging")) {
    target.classList.add("drag-over");
  }
}

function handleDragLeave(event) {
  const target = event.target.closest(".shortcut-item");
  if (target) {
    target.classList.remove("drag-over");
  }
}

// Gestion du popup
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

// Event listeners
addForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
      alert("Veuillez remplir tous les champs");
      return;
    }

    shortcuts.push({ name, url });
    await saveShortcuts();
    displayShortcuts();
    closePopup();
    addForm.reset();
  } catch (error) {
    console.error("Erreur lors de l'ajout du raccourci:", error);
    alert("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
  }
});

addShortcutBtn.addEventListener("click", openPopup);
closePopupBtn.addEventListener("click", closePopup);

clearShortcutsBtn.addEventListener("click", async function () {
  try {
    if (confirm("Êtes-vous sûr de vouloir supprimer tous les raccourcis ?")) {
      shortcuts = [];
      await saveShortcuts();
      displayShortcuts();
    }
  } catch (error) {
    console.error("Erreur lors de la suppression des raccourcis:", error);
    alert(
      "Une erreur est survenue lors de la suppression. Veuillez réessayer."
    );
  }
});

viewToggleButton.addEventListener("click", function () {
  isGridView = !isGridView;
  displayShortcuts();
});

urlInput.addEventListener("input", function () {
  const urlValue = this.value.trim();
  if (!urlChangedOnce && urlValue && nameInput.value === "") {
    nameInput.value = urlValue;
    urlChangedOnce = true;
  }
});

// Initialisation
window.addEventListener("DOMContentLoaded", async () => {
  try {
    shortcuts = await loadShortcuts();
    displayShortcuts();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
  }
});
