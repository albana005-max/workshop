import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCduAN8r3UBfKkvXt3Uv_WYGrzvQCjYJqE",
  authDomain: "daftarbelanjaapp.firebaseapp.com",
  projectId: "daftarbelanjaapp",
  storageBucket: "daftarbelanjaapp.firebasestorage.app",
  messagingSenderId: "790439391097",
  appId: "1:790439391097:web:98f2becc702fa2350989a8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Variabel Global
let currentUser = null; 
let activeListId = null; // Menyimpan ID daftar yang sedang dibuka
let unsubscribeDaftar = null; // Menghentikan listener kumpulan daftar
let unsubscribeBarang = null; // Menghentikan listener isi barang

// Referensi UI Utama
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const namaUserUI = document.getElementById("namaUser");
const pesanError = document.getElementById("pesanError");
const inputUndang = document.getElementById("inputUndang");
const btnUndang = document.getElementById("btnUndang");

// Referensi UI Dashboard (Kumpulan Daftar)
const dashboardLayar = document.getElementById("dashboardLayar");
const kumpulanDaftarUI = document.getElementById("kumpulanDaftarUI");
const inputNamaDaftar = document.getElementById("inputNamaDaftar");
const btnBuatDaftar = document.getElementById("btnBuatDaftar");

// Referensi UI Detail (Isi Barang)
const detailLayar = document.getElementById("detailLayar");
const judulDaftarAktif = document.getElementById("judulDaftarAktif");
const btnKembali = document.getElementById("btnKembali");
const daftarBelanjaUI = document.getElementById("daftarBelanja");
const inputBarang = document.getElementById("inputBarang");
const btnTambah = document.getElementById("btnTambah");

// ==========================================
// 2. LOGIKA AUTENTIKASI
// ==========================================
// (Kode Login, Register, Logout tetap sama seperti sebelumnya)
document.getElementById("btnRegister").addEventListener("click", async () => {
    try { await createUserWithEmailAndPassword(auth, document.getElementById("inputEmail").value, document.getElementById("inputPassword").value); pesanError.textContent = ""; } catch (error) { pesanError.textContent = "Gagal mendaftar: " + error.message; }
});
document.getElementById("btnLogin").addEventListener("click", async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("inputEmail").value, document.getElementById("inputPassword").value); pesanError.textContent = ""; } catch (error) { pesanError.textContent = "Gagal login: " + error.message; }
});
document.getElementById("btnLogout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authSection.style.display = "none";
        appSection.style.display = "block";
        namaUserUI.textContent = user.email.split("@")[0]; 
        
        // Buka layar dashboard dan muat kumpulan daftar miliknya
        bukaDashboard(); 
    } else {
        currentUser = null;
        authSection.style.display = "block";
        appSection.style.display = "none";
        
        // Hentikan semua pembacaan data jika logout
        if (unsubscribeDaftar) unsubscribeDaftar();
        if (unsubscribeBarang) unsubscribeBarang();
    }
});

// ==========================================
// 3. FITUR MANAJEMEN DAFTAR (DASHBOARD)
// ==========================================
function bukaDashboard() {
    dashboardLayar.style.display = "block";
    detailLayar.style.display = "none";
    if (unsubscribeBarang) unsubscribeBarang(); // Hentikan muat isi barang sebelumnya

    const listsRef = collection(db, "shopping_lists");
    // Hanya tampilkan daftar yang dibuat oleh user ini
    const q = query(listsRef, where("anggota", "array-contains", currentUser.email), orderBy("waktuDibuat", "desc"));

    unsubscribeDaftar = onSnapshot(q, (snapshot) => {
        kumpulanDaftarUI.innerHTML = ""; 
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const listId = docSnap.id;
            
            const li = document.createElement("li");
            li.textContent = data.judul;
            li.style.cursor = "pointer";
            li.style.fontWeight = "bold";
            li.style.color = "#007bff";

            // Hapus Daftar
            const btnHapusDaftar = document.createElement("button");
            btnHapusDaftar.textContent = "Hapus List";
            btnHapusDaftar.className = "btn-danger";
            btnHapusDaftar.style.padding = "4px 8px";
            
            btnHapusDaftar.addEventListener("click", async (e) => {
                e.stopPropagation();
                if(confirm(`Hapus daftar '${data.judul}' beserta seluruh isinya?`)){
                    await deleteDoc(doc(db, "shopping_lists", listId));
                }
            });

            li.addEventListener("click", () => bukaDetailDaftar(listId, data.judul));
            
            li.appendChild(btnHapusDaftar);
            kumpulanDaftarUI.appendChild(li);
        });
    });
}

btnBuatDaftar.addEventListener("click", async () => {
    if (inputNamaDaftar.value.trim() === "") return;
    try {
        await addDoc(collection(db, "shopping_lists"), {
            judul: inputNamaDaftar.value,
            pemilik: currentUser.email,
            anggota: [currentUser.email],
            waktuDibuat: new Date()
        });
        inputNamaDaftar.value = "";
    } catch (error) { console.error("Error membuat daftar: ", error); }
});

// ==========================================
// 4. FITUR ISI BARANG (DETAIL LAYAR)
// ==========================================
btnKembali.addEventListener("click", () => bukaDashboard());

function bukaDetailDaftar(listId, judul) {
    dashboardLayar.style.display = "none";
    detailLayar.style.display = "block";
    
    activeListId = listId;
    judulDaftarAktif.textContent = `Daftar: ${judul}`;
    
    // Muat barang-barang di dalam daftar yang diklik
    const itemsRef = collection(db, "shopping_lists", activeListId, "items");
    const q = query(itemsRef, orderBy("waktuDitambahkan", "asc"));

    unsubscribeBarang = onSnapshot(q, (snapshot) => {
        daftarBelanjaUI.innerHTML = ""; 
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const idBarang = docSnap.id; 
            
            const li = document.createElement("li");
            const spanNama = document.createElement("span");
            spanNama.textContent = `${data.namaBarang} (oleh: ${data.ditambahkanOleh.split("@")[0]})`;
            spanNama.style.textDecoration = data.sudahDibeli ? "line-through" : "none";
            spanNama.style.color = data.sudahDibeli ? "#999" : "#333";
            spanNama.style.cursor = "pointer"; 
            spanNama.style.flex = "1"; 
            
            spanNama.addEventListener("click", async () => {
                await updateDoc(doc(db, "shopping_lists", activeListId, "items", idBarang), { sudahDibeli: !data.sudahDibeli });
            });

            const btnHapus = document.createElement("button");
            btnHapus.textContent = "Hapus";
            btnHapus.className = "btn-danger"; 
            btnHapus.style.padding = "5px 10px";

            btnHapus.addEventListener("click", async (e) => {
                e.stopPropagation(); 
                if(confirm(`Hapus ${data.namaBarang}?`)) {
                    await deleteDoc(doc(db, "shopping_lists", activeListId, "items", idBarang));
                }
            });
            
            li.appendChild(spanNama);
            li.appendChild(btnHapus);
            daftarBelanjaUI.appendChild(li);
        });
    });
}

btnTambah.addEventListener("click", async () => {
    if (inputBarang.value.trim() === "" || !activeListId) return;
    try {
        await addDoc(collection(db, "shopping_lists", activeListId, "items"), {
            namaBarang: inputBarang.value,
            sudahDibeli: false,
            waktuDitambahkan: new Date(), 
            ditambahkanOleh: currentUser.email 
        });
        inputBarang.value = ""; 
    } catch (error) { console.error("Error menambah data: ", error); }
});
// ==========================================
// 5. FITUR MENGUNDANG TEMAN
// ==========================================
btnUndang.addEventListener("click", async () => {
    const emailTeman = inputUndang.value.trim();
    
    // Pastikan email tidak kosong dan ada daftar yang sedang aktif
    if (emailTeman === "" || !activeListId) return;

    try {
        // Rujuk langsung ke dokumen daftar belanja yang sedang dibuka
        const listRef = doc(db, "shopping_lists", activeListId);
        
        // Update field 'anggota' dengan menambahkan email teman
        await updateDoc(listRef, {
            anggota: arrayUnion(emailTeman)
        });
        
        alert(`Berhasil! ${emailTeman} sekarang bisa melihat dan mengedit daftar ini.`);
        inputUndang.value = ""; // Kosongkan input setelah sukses
        
    } catch (error) {
        console.error("Gagal mengundang teman: ", error);
        alert("Gagal mengundang. Pastikan email benar.");
    }
});