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

// State Global
let currentUser = null; 
let activeListId = null; 
let activeListJudul = "";
let editingItemId = null; 
let unsubscribeDaftar = null; 
let unsubscribeBarang = null; 
let chartInstance = null; 

// Referensi DOM UI
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const namaUserUI = document.getElementById("namaUser");
const pesanError = document.getElementById("pesanError");

const viewDashboard = document.getElementById("viewDashboard");
const viewDetail = document.getElementById("viewDetail");
const viewStatistik = document.getElementById("viewStatistik");

const menuDashboard = document.getElementById("menuDashboard");
const menuDetail = document.getElementById("menuDetail");
const menuStatistik = document.getElementById("menuStatistik");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const metricTotalBiaya = document.getElementById("metricTotalBiaya");
const metricStatusItem = document.getElementById("metricStatusItem");
const metricTotalDaftar = document.getElementById("metricTotalDaftar");

const kumpulanDaftarUI = document.getElementById("kumpulanDaftarUI");
const inputNamaDaftar = document.getElementById("inputNamaDaftar");
const btnBuatDaftar = document.getElementById("btnBuatDaftar");

const daftarBelanjaUI = document.getElementById("daftarBelanja");
const btnKembali = document.getElementById("btnKembali");
const btnOpenUndang = document.getElementById("btnOpenUndang");
const btnCloseUndang = document.getElementById("btnCloseUndang");
const panelUndang = document.getElementById("panelUndang");
const inputUndang = document.getElementById("inputUndang");
const btnUndang = document.getElementById("btnUndang");

const inputBarang = document.getElementById("inputBarang");
const inputJumlah = document.getElementById("inputJumlah");
const inputSatuan = document.getElementById("inputSatuan");
const inputHarga = document.getElementById("inputHarga");
const btnTambah = document.getElementById("btnTambah");
const btnBatalEdit = document.getElementById("btnBatalEdit");
const labelFormItem = document.getElementById("labelFormItem");

// ==========================================
// 2. LOGIKA AUTENTIKASI AKUN
// ==========================================
document.getElementById("btnRegister").addEventListener("click", async () => {
    try { 
        await createUserWithEmailAndPassword(auth, document.getElementById("inputEmail").value, document.getElementById("inputPassword").value); 
        pesanError.textContent = ""; 
    } catch (e) { 
        pesanError.textContent = "Gagal: " + e.message; 
    }
});

document.getElementById("btnLogin").addEventListener("click", async () => {
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById("inputEmail").value, document.getElementById("inputPassword").value); 
        pesanError.textContent = ""; 
    } catch (e) { 
        pesanError.textContent = "Gagal: " + e.message; 
    }
});

document.getElementById("btnLogout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authSection.style.display = "none";
        appSection.style.display = "flex";
        namaUserUI.textContent = user.email.split("@")[0]; 
        bukaDashboard(); 
    } else {
        currentUser = null;
        authSection.style.display = "flex";
        appSection.style.display = "none";
        if (unsubscribeDaftar) unsubscribeDaftar();
        if (unsubscribeBarang) unsubscribeBarang();
    }
});

// ==========================================
// 3. NAVIGASI ALUR TAMPILAN
// ==========================================
function resetActiveMenu() {
    menuDashboard.classList.remove("active");
    menuDetail.classList.remove("active");
    menuStatistik.classList.remove("active");
}

function bukaDashboard() {
    viewDashboard.style.display = "block";
    viewDetail.style.display = "none";
    viewStatistik.style.display = "none";
    
    menuDetail.style.display = "none";
    menuStatistik.style.display = "none";

    resetActiveMenu();
    menuDashboard.classList.add("active");
    
    pageTitle.textContent = "Overview Dashboard";
    pageSubtitle.textContent = "Pantau seluruh aktivitas ringkasan belanjaan Anda.";
    
    if (unsubscribeBarang) unsubscribeBarang();
    resetFormEdit();
    loadDaftarBelanja();
}

function bukaViewDetailItem() {
    viewDashboard.style.display = "none";
    viewStatistik.style.display = "none";
    viewDetail.style.display = "block";
    
    resetActiveMenu();
    menuDetail.classList.add("active");

    pageTitle.textContent = `List: ${activeListJudul}`;
    pageSubtitle.textContent = "Kelola detail rincian barang belanjaan.";
}

function bukaViewStatistik() {
    viewDashboard.style.display = "none";
    viewDetail.style.display = "none";
    viewStatistik.style.display = "block";
    
    resetActiveMenu();
    menuStatistik.classList.add("active");

    pageTitle.textContent = `Statistik: ${activeListJudul}`;
    pageSubtitle.textContent = "Analisis pengeluaran harian dari transaksi daftar ini.";
}

menuDashboard.addEventListener("click", (e) => {
    e.preventDefault();
    bukaDashboard();
});

menuDetail.addEventListener("click", (e) => {
    e.preventDefault();
    bukaViewDetailItem();
});

menuStatistik.addEventListener("click", (e) => {
    e.preventDefault();
    bukaViewStatistik();
});

btnKembali.addEventListener("click", () => bukaDashboard());

// ==========================================
// 4. LOAD KUMPULAN DAFTAR BELANJA
// ==========================================
function loadDaftarBelanja() {
    const listsRef = collection(db, "shopping_lists");
    const q = query(listsRef, where("anggota", "array-contains", currentUser.email), orderBy("waktuDibuat", "desc"));

    unsubscribeDaftar = onSnapshot(q, (snapshot) => {
        kumpulanDaftarUI.innerHTML = ""; 
        metricTotalDaftar.textContent = `${snapshot.size} List`;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const listId = docSnap.id;
            
            const li = document.createElement("li");
            li.className = "list-item";
            
            const spanInfo = document.createElement("div");
            spanInfo.className = "item-info";
            const tgl = data.waktuDibuat ? new Date(data.waktuDibuat.toDate()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '';
            spanInfo.innerHTML = `
                <div class="item-title"><i class="fa-solid fa-folder" style="color:var(--primary);"></i> ${data.judul}</div>
                <div class="item-meta">Dibuat: ${tgl} • Anggota: ${data.anggota ? data.anggota.length : 1} orang</div>
            `;
            spanInfo.addEventListener("click", () => bukaDetailDaftar(listId, data.judul));

            const actionDiv = document.createElement("div");
            actionDiv.className = "item-actions";

            const btnHapus = document.createElement("button");
            btnHapus.className = "btn-icon delete";
            btnHapus.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            btnHapus.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`Hapus daftar '${data.judul}'?`)) {
                    await deleteDoc(doc(db, "shopping_lists", listId));
                }
            });

            actionDiv.appendChild(btnHapus);
            li.appendChild(spanInfo);
            li.appendChild(actionDiv);
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
    } catch (e) { console.error(e); }
});

// ==========================================
// 5. DETAIL BARANG & CHART REALTIME
// ==========================================
function bukaDetailDaftar(listId, judul) {
    activeListId = listId;
    activeListJudul = judul;

    menuDetail.style.display = "flex";
    menuStatistik.style.display = "flex";

    bukaViewDetailItem();
    resetFormEdit();

    const itemsRef = collection(db, "shopping_lists", activeListId, "items");
    const q = query(itemsRef, orderBy("waktuDitambahkan", "asc"));

    unsubscribeBarang = onSnapshot(q, (snapshot) => {
        daftarBelanjaUI.innerHTML = ""; 
        
        let totalPengeluaran = 0;
        let totalItem = 0;
        let selesaiCount = 0;
        let rekapHarian = {}; 

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const idBarang = docSnap.id; 
            
            totalItem++;
            const jml = Number(data.jumlah) || 1;
            const hrg = Number(data.harga) || 0;
            const subtotal = hrg * jml;

            if (data.sudahDibeli) {
                selesaiCount++;
                totalPengeluaran += subtotal;

                const dateObj = data.waktuDitambahkan ? data.waktuDitambahkan.toDate() : new Date();
                const tglStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});

                if (!rekapHarian[tglStr]) rekapHarian[tglStr] = 0;
                rekapHarian[tglStr] += subtotal; 
            }

            const li = document.createElement("li");
            li.className = "list-item";
            
            const spanDetail = document.createElement("div");
            spanDetail.className = "item-info";
            
            const pencatat = data.ditambahkanOleh ? data.ditambahkanOleh.split("@")[0] : "";
            const waktuFormat = data.waktuDitambahkan 
                ? new Date(data.waktuDitambahkan.toDate()).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) 
                : '';

            const iconCheck = data.sudahDibeli 
                ? '<i class="fa-solid fa-circle-check" style="color: var(--primary); font-size: 18px;"></i>' 
                : '<i class="fa-regular fa-circle" style="color: #cbd5e1; font-size: 18px;"></i>';

            spanDetail.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center;">
                    ${iconCheck}
                    <div>
                        <div class="item-title" style="text-decoration: ${data.sudahDibeli ? 'line-through' : 'none'}; color: ${data.sudahDibeli ? 'var(--text-muted)' : 'var(--text-dark)'};">
                            ${data.namaBarang} (${jml} ${data.satuan})
                        </div>
                        <div class="item-meta">
                            Subtotal: Rp ${subtotal.toLocaleString('id-ID')} • 👤 ${pencatat} • 🕒 ${waktuFormat}
                        </div>
                    </div>
                </div>
            `;
            
            spanDetail.addEventListener("click", async () => {
                await updateDoc(doc(db, "shopping_lists", activeListId, "items", idBarang), { sudahDibeli: !data.sudahDibeli });
            });

            const actionContainer = document.createElement("div");
            actionContainer.className = "item-actions";

            const btnEdit = document.createElement("button");
            btnEdit.className = "btn-icon edit";
            btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i>';
            btnEdit.addEventListener("click", (e) => {
                e.stopPropagation();
                inputBarang.value = data.namaBarang;
                inputJumlah.value = data.jumlah || 1;
                inputSatuan.value = data.satuan || "pcs";
                inputHarga.value = data.harga || 0;
                
                editingItemId = idBarang; 
                btnTambah.textContent = "Simpan Perubahan";
                labelFormItem.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Barang';
                btnBatalEdit.style.display = "inline-flex";
                inputBarang.focus();
            });

            const btnHapus = document.createElement("button");
            btnHapus.className = "btn-icon delete";
            btnHapus.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            btnHapus.addEventListener("click", async (e) => {
                e.stopPropagation(); 
                if (confirm(`Hapus ${data.namaBarang}?`)) {
                    await deleteDoc(doc(db, "shopping_lists", activeListId, "items", idBarang));
                    if (editingItemId === idBarang) resetFormEdit();
                }
            });
            
            actionContainer.appendChild(btnEdit);
            actionContainer.appendChild(btnHapus);

            li.appendChild(spanDetail);
            li.appendChild(actionContainer);
            daftarBelanjaUI.appendChild(li);
        });

        metricTotalBiaya.textContent = `Rp ${totalPengeluaran.toLocaleString('id-ID')}`;
        metricStatusItem.textContent = `${selesaiCount} / ${totalItem}`;

        const labels = Object.keys(rekapHarian);
        const dataValues = Object.values(rekapHarian);

        renderGrafik(labels.length > 0 ? labels : ["Belum Dibeli"], labels.length > 0 ? dataValues : [0]);
    });
}

function resetFormEdit() {
    editingItemId = null;
    inputBarang.value = ""; 
    inputJumlah.value = "1";
    inputSatuan.value = "pcs";
    inputHarga.value = "";
    btnTambah.textContent = "Simpan Item";
    labelFormItem.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Tambah Item Belanja';
    btnBatalEdit.style.display = "none";
}

btnBatalEdit.addEventListener("click", () => resetFormEdit());

btnTambah.addEventListener("click", async () => {
    if (inputBarang.value.trim() === "" || !activeListId) return;

    try {
        if (editingItemId) {
            await updateDoc(doc(db, "shopping_lists", activeListId, "items", editingItemId), {
                namaBarang: inputBarang.value,
                jumlah: Number(inputJumlah.value) || 1,
                satuan: inputSatuan.value,
                harga: Number(inputHarga.value) || 0
            });
            resetFormEdit();
        } else {
            await addDoc(collection(db, "shopping_lists", activeListId, "items"), {
                namaBarang: inputBarang.value,
                jumlah: Number(inputJumlah.value) || 1,
                satuan: inputSatuan.value,
                harga: Number(inputHarga.value) || 0,
                sudahDibeli: false,
                waktuDitambahkan: new Date(), 
                ditambahkanOleh: currentUser.email 
            });
            resetFormEdit();
        }
    } catch (e) { 
        console.error("Gagal menyimpan item:", e); 
    }
});

// GRAFIK CHART.JS
function renderGrafik(labels, dataValues) {
    const ctx = document.getElementById('grafikBelanja').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pengeluaran (Rp)',
                data: dataValues,
                backgroundColor: '#00AA5B',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// PANEL UNDANG
btnOpenUndang.addEventListener("click", () => panelUndang.style.display = "block");
btnCloseUndang.addEventListener("click", () => panelUndang.style.display = "none");

btnUndang.addEventListener("click", async () => {
    const email = inputUndang.value.trim();
    if (email === "" || !activeListId) return;

    try {
        await updateDoc(doc(db, "shopping_lists", activeListId), {
            anggota: arrayUnion(email)
        });
        alert(`Berhasil! ${email} telah diundang.`);
        inputUndang.value = "";
        panelUndang.style.display = "none";
    } catch (e) { 
        alert("Gagal mengundang anggota."); 
    }
});
