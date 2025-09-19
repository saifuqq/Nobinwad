// AI กรอกข้อมูลอัตโนมัติและ preview เมื่อวางข้อความใน bulkProductTextarea
document.addEventListener('DOMContentLoaded', function() {
    // --- BULK IMPORT/EXPORT ---
    window.exportProducts = function() {
        const data = JSON.stringify(products, null, 2);
        const blob = new Blob([data], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products-export.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        showToast('ส่งออกสินค้าเป็นไฟล์ JSON เรียบร้อย', 'success');
    };

    window.showBulkImportModal = function() {
        document.getElementById('bulkImportModal').classList.remove('hidden');
        document.getElementById('bulkImportModal').classList.add('flex');
        document.getElementById('bulkImportTextarea').value = '';
    };
    window.closeBulkImportModal = function() {
        document.getElementById('bulkImportModal').classList.add('hidden');
        document.getElementById('bulkImportModal').classList.remove('flex');
    };
    window.confirmBulkImport = function() {
        const text = document.getElementById('bulkImportTextarea').value.trim();
        if (!text) { showToast('กรุณาวางข้อมูลสินค้า', 'error'); return; }
        let imported;
        try {
            if (text.startsWith('{') || text.startsWith('[')) {
                imported = JSON.parse(text);
            } else if (text.includes(',')) {
                // CSV (simple: name,type,price,desc per line)
                imported = {};
                text.split('\n').forEach(line => {
                    const [name,type,price,desc] = line.split(',');
                    if (!name || !price) return;
                    const prod = { baseName: name.trim(), variants: [{type: type?.trim()||'', price: Number(price)}], description: desc?.trim()||'' };
                    const cat = Object.keys(products)[0];
                    imported[cat] = imported[cat]||[];
                    imported[cat].push(prod);
                });
            } else {
                throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
            }
        } catch(e) {
            showToast('นำเข้าไม่สำเร็จ: ' + e.message, 'error');
            return;
        }
        // merge/replace
        Object.assign(products, imported);
        closeBulkImportModal();
        renderAdminProductListByCategory();
        showToast('นำเข้าสินค้าสำเร็จ', 'success');
    };
    // --- ADMIN CRUD PRODUCT ---
    let editingProduct = null; // {cat, idx} หรือ null

    window.showEditProductModal = function(mode, cat, idx) {
        const modal = document.getElementById('adminEditProductModal');
        const form = document.getElementById('adminEditProductForm');
        const title = document.getElementById('editProductModalTitle');
        if (!modal || !form) return;
        form.reset();
        editingProduct = null;
        if (mode === 'edit' && cat && typeof idx === 'number') {
            const prod = products[cat][idx];
            if (!prod) return;
            document.getElementById('editProductName').value = prod.baseName||'';
            document.getElementById('editProductType').value = prod.variants?.[0]?.type||'';
            document.getElementById('editProductPrice').value = prod.variants?.[0]?.price||'';
            document.getElementById('editProductDesc').value = prod.description||'';
            title.textContent = 'แก้ไขสินค้า';
            editingProduct = {cat, idx};
        } else {
            title.textContent = 'เพิ่มสินค้าใหม่';
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };
    window.closeEditProductModal = function() {
        const modal = document.getElementById('adminEditProductModal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        editingProduct = null;
    };
    document.getElementById('adminEditProductForm').onsubmit = function(e) {
        e.preventDefault();
        const name = document.getElementById('editProductName').value.trim();
        const type = document.getElementById('editProductType').value.trim();
        const price = Number(document.getElementById('editProductPrice').value);
        const desc = document.getElementById('editProductDesc').value.trim();
        if (!name || !price) { showToast('กรุณากรอกชื่อและราคา', 'error'); return; }
        let prod = { baseName: name, variants: [{type, price}], description: desc };
        if (editingProduct) {
            // edit
            products[editingProduct.cat][editingProduct.idx] = prod;
            showToast('แก้ไขสินค้าสำเร็จ', 'success');
        } else {
            // add to first category
            const firstCat = Object.keys(products)[0];
            products[firstCat].push(prod);
            showToast('เพิ่มสินค้าใหม่สำเร็จ', 'success');
        }
        closeEditProductModal();
        renderAdminProductListByCategory();
    };
    window.deleteProduct = function(cat, idx) {
        if (!confirm('ยืนยันลบสินค้า?')) return;
        products[cat].splice(idx,1);
        renderAdminProductListByCategory();
        showToast('ลบสินค้าแล้ว', 'success');
    };

    // ปรับ renderAdminProductListByCategory ให้มีปุ่มแก้ไข/ลบ
    const origRenderAdminProductListByCategory = window.renderAdminProductListByCategory;
    window.renderAdminProductListByCategory = function() {
        origRenderAdminProductListByCategory();
        // เพิ่มปุ่มแก้ไข/ลบในแต่ละสินค้า
        const container = document.getElementById('adminProductListByCategory');
        if (!container) return;
        container.querySelectorAll('.admin-product-row').forEach(row => row.remove());
        Object.entries(products).forEach(([cat, arr]) => {
            arr.forEach((prod, idx) => {
                const div = document.createElement('div');
                div.className = 'admin-product-row flex items-center justify-between gap-2 border-b py-2';
                div.innerHTML = `<div><b>${prod.baseName}</b> <span class='text-gray-500 text-sm'>${prod.variants?.[0]?.type||''}</span> <span class='text-pink-500 font-bold'>${prod.variants?.[0]?.price||''}฿</span></div>
                <div class='flex gap-2'>
                    <button onclick="showEditProductModal('edit','${cat}',${idx})" class="btn-info px-3 py-1 rounded">แก้ไข</button>
                    <button onclick="deleteProduct('${cat}',${idx})" class="btn-danger px-3 py-1 rounded">ลบ</button>
                </div>`;
                container.appendChild(div);
            });
        });
    };
    // --- ADMIN DASHBOARD: Google Sheet Integration ---
    const GOOGLE_SHEET_ID = '1dM6604ZWXRrZ5v9aF6F2SvqSFcu4COXjrHB1oyWUc4I';
    const GOOGLE_SHEET_NAME = 'Sheet1'; // เปลี่ยนชื่อชีตถ้าไม่ใช่ Sheet1
    async function fetchDashboardDataFromSheet() {
        try {
            const url = `https://opensheet.elk.sh/${GOOGLE_SHEET_ID}/${GOOGLE_SHEET_NAME}`;
            const res = await fetch(url);
            const data = await res.json();
            return data; // array ของ row
        } catch (e) {
            showToast('เชื่อมต่อ Google Sheet ไม่สำเร็จ', 'error');
            return [];
        }
    }

    window.updateAdminDashboard = async function() {
        // ดึงข้อมูลจาก Google Sheet
        const data = await fetchDashboardDataFromSheet();
        // สมมติ column: name, type, price, customer, date
        // จำนวนสินค้า
        const elTotalProducts = document.getElementById('dashboardTotalProducts');
        if (elTotalProducts) elTotalProducts.textContent = data.length;
        // Mock: จำนวนลูกค้า (นับ unique customer)
        const elTotalCustomers = document.getElementById('dashboardTotalCustomers');
        if (elTotalCustomers) {
            const customers = [...new Set(data.map(row => row.customer).filter(Boolean))];
            elTotalCustomers.textContent = customers.length;
        }
        // สินค้าขายดี (mock: top 3 by name)
        const elBestSellers = document.getElementById('dashboardBestSellers');
        if (elBestSellers) {
            const count = {};
            data.forEach(row => { if(row.name) count[row.name] = (count[row.name]||0)+1; });
            const best = Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,3);
            elBestSellers.innerHTML = best.map(([name,qty])=>`<li>${name} (${qty})</li>`).join('') || '<li>-</li>';
        }
        // ลูกค้าใหม่ล่าสุด (mock: 2 คนล่าสุด)
        const elRecentCustomers = document.getElementById('dashboardRecentCustomers');
        if (elRecentCustomers) {
            const sorted = data.filter(r=>r.customer&&r.date).sort((a,b)=>new Date(b.date)-new Date(a.date));
            const latest = sorted.slice(0,2);
            elRecentCustomers.innerHTML = latest.map(r=>`<li>${r.customer} (${r.date})</li>`).join('') || '<li>-</li>';
        }
    };
    // --- ADMIN DASHBOARD ---
    window.updateAdminDashboard = function() {
        // จำนวนสินค้าทั้งหมด
        let totalProducts = 0;
        for (const cat in products) {
            totalProducts += (products[cat]?.length || 0);
        }
        const elTotalProducts = document.getElementById('dashboardTotalProducts');
        if (elTotalProducts) elTotalProducts.textContent = totalProducts;

        // Mock: จำนวนลูกค้า
        const elTotalCustomers = document.getElementById('dashboardTotalCustomers');
        if (elTotalCustomers) elTotalCustomers.textContent = 12; // ตัวอย่าง

        // Mock: สินค้าขายดี
        const elBestSellers = document.getElementById('dashboardBestSellers');
        if (elBestSellers) {
            elBestSellers.innerHTML = '<li>DEE (แดง)</li><li>SPA (แดง)</li><li>VESS GOLD</li>';
        }

        // Mock: ลูกค้าใหม่ล่าสุด
        const elRecentCustomers = document.getElementById('dashboardRecentCustomers');
        if (elRecentCustomers) {
            elRecentCustomers.innerHTML = '<li>คุณ A (25/08/2025)</li><li>คุณ B (24/08/2025)</li>';
        }
    };

    // เรียกอัปเดตแดชบอร์ดทุกครั้งที่เปิดแผงแอดมิน
    const origToggleAdminPanelModal = window.toggleAdminPanelModal;
    window.toggleAdminPanelModal = function() {
        origToggleAdminPanelModal();
        setTimeout(window.updateAdminDashboard, 100);
    };
    // Shopping cart functionality has been removed

    // --- REVIEW LOGIC (mock) ---
    window.showReviewSubmissionModal = function() {
        showToast('ฟีเจอร์รีวิว: อยู่ระหว่างพัฒนา', 'info');
    };
    window.showReviewsSection = function() {
        document.getElementById('customer-reviews-section').scrollIntoView({behavior:'smooth'});
    };

    // --- AI SUGGEST (mock) ---
    window.renderAISuggestions = function() {
        const grid = document.getElementById('aiSuggestionsGrid');
        if (!grid) return;
        grid.innerHTML = '<div class="text-gray-400 text-center py-8">AI แนะนำสินค้า: อยู่ระหว่างพัฒนา</div>';
    };
    renderAISuggestions();

    // --- SEARCH ---
    window.filterProducts = function() {
        showToast('ฟีเจอร์ค้นหา: อยู่ระหว่างพัฒนา', 'info');
    };
    // --- DARK MODE TOGGLE ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeIcon = document.getElementById('darkModeIcon');
    function setDarkMode(on) {
        if (on) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', '1');
            if (darkModeIcon) darkModeIcon.textContent = '☀️';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', '0');
            if (darkModeIcon) darkModeIcon.textContent = '🌙';
        }
    }
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            setDarkMode(!isDark);
        });
        // โหลด dark mode จาก localStorage
        setDarkMode(localStorage.getItem('darkMode') === '1');
    }

    // --- TOAST NOTIFICATION ---
    window.showToast = function(msg, type = 'info', timeout = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `px-4 py-2 rounded-lg shadow-lg text-white font-semibold flex items-center gap-2 animate-fade-in ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500 text-black' : 'bg-gray-800'}`;
        toast.innerHTML = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, timeout);
    };

    // --- ANIMATION UTILS ---
    // เพิ่ม class animate-fade-in ใน tailwind.config.js หรือใช้ inline style
    // .animate-fade-in { animation: fadeIn 0.5s; }
    // @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
    // Bulk Check Modal: Enable/disable 'เช็คสินค้าสำเร็จ' button
    const bulkCheckTextarea = document.getElementById('bulkCheckTextarea');
    const confirmBulkCheckBtn = document.getElementById('confirmBulkCheckBtn');
    if (bulkCheckTextarea && confirmBulkCheckBtn) {
        const updateBulkCheckBtnState = () => {
            const text = bulkCheckTextarea.value.trim();
            if (!text) {
                confirmBulkCheckBtn.disabled = true;
                return;
            }
            try {
                let parsed = parseBulkProductText(text);
                confirmBulkCheckBtn.disabled = parsed.length === 0;
            } catch {
                confirmBulkCheckBtn.disabled = true;
            }
        };
        bulkCheckTextarea.addEventListener('input', updateBulkCheckBtnState);
        bulkCheckTextarea.addEventListener('paste', function() { setTimeout(updateBulkCheckBtnState, 50); });
        // เรียกครั้งแรกเมื่อ modal เปิด
        if (typeof openBulkCheckModal === 'function') {
            const origOpen = openBulkCheckModal;
            window.openBulkCheckModal = function() {
                origOpen();
                setTimeout(updateBulkCheckBtnState, 10);
            };
        }
    }
    const bulkProductTextarea = document.getElementById('bulkProductTextarea');
    const bulkProductPreview = document.getElementById('bulkProductPreview');
    const bulkProductSendBtn = document.getElementById('bulkProductSendBtn');
    if (bulkProductTextarea && bulkProductPreview) {
        const previewBulkProduct = () => {
            const text = bulkProductTextarea.value.trim();
            if (!text) {
                bulkProductPreview.innerHTML = '<span class="text-gray-400">กรุณาวางข้อความสินค้า</span>';
                return;
            }
            try {
                let parsed = parseBulkProductText(text);
                if (!parsed.length) {
                    bulkProductPreview.innerHTML = '<span class="text-red-500">ไม่พบสินค้าที่ถูกต้อง</span>';
                    return;
                }
                let html = '<div class="text-left">';
                parsed.forEach((p, i) => {
                    let typeText = '';
                    if (p.variants && p.variants.length > 0) {
                        typeText = p.variants.map(v => v.type).filter(Boolean).join(' / ');
                    }
                    let priceText = '';
                    if (p.variants && p.variants.length > 0) {
                        let prices = p.variants.map(v => v.price ? v.price : null).filter(Boolean);
                        priceText = prices.length > 0 ? prices.join(' / ') : 'ราคาไม่ระบุ';
                    } else {
                        priceText = 'ราคาไม่ระบุ';
                    }
                    let status = p.status || 'มี';
                    let line = `<b>${p.baseName}</b>`;
                    if (typeText) line += ` (${typeText})`;
                    line += `: ${priceText} - <span class='${status.includes('ของหมด') ? 'text-red-500' : status.includes('จำกัด') ? 'text-yellow-500' : status.includes('เข้าแล้ว') ? 'text-green-600' : 'text-green-600'}'>${status}</span>`;
                    html += `<div class='mb-1'>${line}</div>`;
                });
                html += '</div>';
                bulkProductPreview.innerHTML = html;
            } catch (e) {
                bulkProductPreview.innerHTML = '<span class="text-red-500">เกิดข้อผิดพลาด: ' + e.message + '</span>';
            }
        };
        bulkProductTextarea.addEventListener('input', previewBulkProduct);
        bulkProductTextarea.addEventListener('paste', function() { setTimeout(previewBulkProduct, 50); });
    }
    if (bulkProductSendBtn) {
        bulkProductSendBtn.addEventListener('click', function() {
            // เรียกฟังก์ชันเพิ่มสินค้า bulk จริง
            if (typeof confirmBulkAddProducts === 'function') {
                confirmBulkAddProducts();
            } else {
                showToast('ไม่พบฟังก์ชันเพิ่มสินค้า bulk', 'error');
            }
        });
    }
});
// ...existing code...
// ฟังก์ชันสำหรับปุ่ม 'เช็คสินค้าสำเร็จ' (สามารถต่อยอด logic เพิ่มสินค้าได้)
function confirmBulkCheckProducts() {
    // ดึงข้อความจาก textarea
    const text = document.getElementById('bulkCheckTextarea').value.trim();
    if (!text) {
        showToast('กรุณาวางข้อความสินค้า', 'error');
        return;
    }
    let parsed;
    try {
        parsed = parseBulkProductText(text);
    } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
        return;
    }
    if (!parsed.length) {
        showToast('ไม่พบสินค้าที่ถูกต้อง', 'error');
        return;
    }
    // รีเช็คและอัปเดตสถานะสินค้าทั้งหมดในระบบก่อนทุกครั้ง (ใช้ status จาก parsed โดยตรง)
    const statusMap = {};
    parsed.forEach((p) => {
        statusMap[p.baseName.trim()] = { status: p.status, parsed: p };
    });

    for (const cat in products) {
        products[cat] = products[cat].map(prod => {
            const found = statusMap[prod.baseName?.trim()];
            if (found) {
                let variants = (found.parsed.variants||[]).map((v, idx) => {
                    let price = v.price;
                    if (!price && prod.variants && prod.variants[idx] && prod.variants[idx].price) {
                        price = prod.variants[idx].price;
                    }
                    return { ...v, price };
                });
                return {
                    ...prod,
                    ...found.parsed,
                    variants,
                    status: found.status
                };
            }
            return prod;
        });
    }

    parsed.forEach((p) => {
        let found = null, foundCat = null;
        for (const cat in products) {
            found = products[cat]?.find(prod => prod.baseName && prod.baseName.trim() === p.baseName.trim());
            if (found) { foundCat = cat; break; }
        }
        if (!found) {
            const firstCat = Object.keys(products)[0];
            products[firstCat] = products[firstCat] || [];
            products[firstCat].push({ ...p, status: p.status || 'มี' });
        }
    });

    if (cart && cart.items) {
        cart.items.forEach(item => {
            const found = statusMap[item.baseName?.trim()];
            if (found) {
                if (found.status === 'ของหมด') {
                    item.status = 'ของหมด';
                } else if (found.status === 'จำกัดออเดอร์') {
                    item.status = 'จำกัดสินค้า';
                } else if (found.status === 'ของเข้าแล้ว') {
                    item.status = 'ของเข้าแล้ว';
                } else {
                    item.status = '';
                }
                if (item.variantIdx != null && found.parsed.variants && found.parsed.variants[item.variantIdx] && found.parsed.variants[item.variantIdx].price) {
                    item.price = found.parsed.variants[item.variantIdx].price;
                }
            }
        });
    }

    renderAdminProductListByCategory && renderAdminProductListByCategory();
    renderProducts();
    updateCartDisplay && updateCartDisplay();
    closeBulkCheckModal();
    showToast('เช็คสินค้าและเพิ่ม/อัปเดตสินค้าเรียบร้อย', 'success');
}
// ===== Bulk Check Modal Logic =====
function openBulkCheckModal() {
    document.getElementById('bulkCheckModal').classList.remove('hidden');
    document.getElementById('bulkCheckTextarea').value = '';
    document.getElementById('bulkCheckPreview').innerHTML = '';
}

function closeBulkCheckModal() {
    document.getElementById('bulkCheckModal').classList.add('hidden');
}

function previewBulkCheckProducts() {
    const text = document.getElementById('bulkCheckTextarea').value.trim();
    if (!text) {
        document.getElementById('bulkCheckPreview').innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
        return;
    }
    try {
        let parsed = parseBulkProductText(text);
        if (!parsed.length) {
            document.getElementById('bulkCheckPreview').innerHTML = '<span class="text-red-500">ไม่พบสินค้าที่ถูกต้อง</span>';
            return;
        }
        let html = '<div class="text-left">';
        parsed.forEach((p, i) => {
            // รวมชนิดสินค้า
            let typeText = '';
            if (p.variants && p.variants.length > 0) {
                typeText = p.variants.map(v => v.type).filter(Boolean).join(' / ');
            }
            // ราคาสินค้า
            let priceText = '';
            if (p.variants && p.variants.length > 0) {
                let prices = p.variants.map(v => v.price ? v.price : null).filter(Boolean);
                if (prices.length > 0) {
                    priceText = prices.join(' / ');
                } else {
                    priceText = 'ราคาไม่ระบุ';
                }
            } else {
                priceText = 'ราคาไม่ระบุ';
            }
            // รูปแบบ: ชื่อ (ชนิด): ราคา - สถานะ
            let status = p.status || 'มี';
            let line = `<b>${p.baseName}</b>`;
            if (typeText) line += ` (${typeText})`;
            line += `: ${priceText} - <span class='${status.includes('ของหมด') ? 'text-red-500' : status.includes('จำกัด') ? 'text-yellow-500' : status.includes('เข้าแล้ว') ? 'text-green-600' : 'text-green-600'}'>${status}</span>`;
            html += `<div class='mb-1'>${line}</div>`;
        });
        html += '</div>';
        document.getElementById('bulkCheckPreview').innerHTML = html;
    } catch (e) {
        document.getElementById('bulkCheckPreview').innerHTML = '<span class="text-red-500">เกิดข้อผิดพลาด: ' + e.message + '</span>';
    }
}
// Global variables for category selection
let currentCategory = 'ทั้งหมด';

// Admin password (FOR DEMONSTRATION ONLY - NOT SECURE FOR PRODUCTION)
const ADMIN_PASSWORD = 'saifu.120447.';
let adminLoginAttempts = 0;
let adminLoginBlockedUntil = 0;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_BLOCK_TIME = 30 * 1000; // 30 วินาที

// Product data organized by category, now with baseName and variants
const products = {
     "สายร้อน": [
        {
            baseName: "DEE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DEE",
            inStock: true, //ฟ เพิ่มสถานะสต็อก
            variants: [
                { type: "แดง", price: 180 },
                { type: "เหลือง", price: 180 }
            ],
            description: "บุหรี่ DEE ให้ความรู้สึกร้อนแรงและเข้มข้น เหมาะสำหรับผู้ที่ชื่นชอบรสชาติจัดจ้าน"
        },
        {
            baseName: "ROYAL ASCOT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ROYAL+ASCOT",
            inStock: true,
            variants: [
                { type: "แดง", price: 190 }
            ],
            description: "ROYAL ASCOT มอบประสบการณ์การสูบที่หรูหราและมีระดับ ด้วยกลิ่นอายคลาสสิก"
        },
        {
            baseName: "ZETRA",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ZETRA",
            inStock: false, // ตัวอย่างสินค้าหมด
            variants: [
                { type: "แดง", price: 180 }
            ],
            description: "ZETRA รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "ZEUS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ZEUS",
            inStock: true,
            variants: [
                { type: "แดง", price: 200 },
                { type: "เหลือง", price: 200 }
            ],
            description: "ZEUS บุหรี่ที่มีพลังและรสชาติที่ลงตัว ให้ความรู้สึกสดชื่นและกระปรี้กระเปร่า"
        },
        {
            baseName: "GTR PLATINUM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GTR+PLATINUM",
            inStock: true,
            variants: [
                { type: "Original", price: 220 }
            ],
            description: "GTR PLATINUM มอบความหรูหราและความประณีตในทุกคำสูบ"
        },
        {
            baseName: "SPA",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SPA",
            inStock: true,
            variants: [
                { type: "แดง", price: 220 }
            ],
            description: "SPA ให้ความรู้สึกผ่อนคลายและสบาย ด้วยกลิ่นหอมอ่อนๆ ที่เป็นเอกลักษณ์"
        },
        {
            baseName: "CAPITAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAPITAL",
            inStock: true,
            variants: [
                { type: "แดง", price: 220 }
            ],
            description: "CAPITAL บุหรี่ที่ให้ความรู้สึกมั่นคงและมีสไตล์ เหมาะสำหรับทุกโอกาส"
        },
        {
            baseName: "ORION",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORION",
            inStock: true,
            variants: [
                { type: "แดง", price: 220 },
                { type: "เหลือง", price: 220 }
            ],
            description: "ORION ให้รสชาติที่กลมกล่อมและนุ่มนวล ชวนให้นึกถึงดวงดาวบนท้องฟ้า"
        },
        {
            baseName: "MOND",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND",
            inStock: true,
            variants: [
                { type: "ดำทอง", price: 220 },
                { type: "ดำน้ำเงิน", price: 220 }
            ],
            description: "MOND บุหรี่ที่มีสไตล์และรสชาติที่หลากหลาย ให้คุณเลือกตามอารมณ์"
        },
        {
            baseName: "HARVY",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=HARVY",
            inStock: true,
            variants: [
                { type: "แดง", price: 200 },
                { type: "เขียว", price: 200 }
            ],
            description: "HARVY ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "COMPLY ORIGINAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=COMPLY",
            inStock: true,
            variants: [
                { type: "ดำแดง", price: 220 }
            ],
            description: "COMPLY ORIGINAL รสชาติต้นตำรับที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "SANTARA",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SANTARA",
            inStock: true,
            variants: [
                { type: "แดง", price: 200 },
                { type: "น้ำเงิน", price: 200 }
            ],
            description: "SANTARA มอบความสดชื่นและรสชาติที่ลงตัว ให้คุณรู้สึกผ่อนคลาย"
        },
        {
            baseName: "TESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=TESS",
            inStock: true,
            variants: [
                { type: "แดง", price: 210 },
                { type: "เขียว", price: 210 }
            ],
            description: "TESS บุหรี่ที่ให้ความรู้สึกนุ่มนวลและสบาย เหมาะสำหรับทุกช่วงเวลา"
        },
        {
            baseName: "VESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS",
            inStock: true,
            variants: [
                { type: "แดง", price: 200 },
                { type: "เขียว", price: 200 },
                { type: "น้ำเงิน", price: 200 }
            ],
            description: "VESS บุหรี่ที่มีรสชาติหลากหลาย ให้คุณเลือกตามความชอบ"
        },
        {
            baseName: "VESS (แฟนตาซี)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+FANTASY",
            inStock: true,
            variants: [
                { type: "แดง", price: 220 }
            ],
            description: "VESS แฟนตาซี มอบประสบการณ์การสูบที่แปลกใหม่และน่าตื่นเต้น"
        },
        {
            baseName: "VESS (แฟนตาซี) 2",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+FANTASY2",
            inStock: true,
            variants: [
                { type: "แดง", price: 230 }
            ],
            description: "VESS แฟนตาซี 2 รสชาติที่เข้มข้นขึ้น ให้ความรู้สึกที่แตกต่าง"
        },
        {
            baseName: "VESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+GOLD",
            inStock: true,
            variants: [
                { type: "GOLD", price: 250 }
            ],
            description: "VESS GOLD มอบความหรูหราและรสชาติที่ลงตัวในทุกคำสูบ"
        },
        {
            baseName: "VESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+GREEN",
            inStock: true,
            variants: [
                { type: "เขียว", price: 210 }
            ],
            description: "VESS เขียว ให้ความรู้สึกสดชื่นและเย็นสบาย เหมาะสำหรับวันที่ต้องการความสดใส"
        },
        {
            baseName: "VESS (VIP GUM MINT)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+VIP",
            inStock: true,
            variants: [
                { type: "ดำเหลือง", price: 250 }
            ],
            description: "VESS VIP GUM MINT มอบความสดชื่นของมิ้นต์และรสชาติที่เข้มข้น"
        },
        {
            baseName: "ATLANTA",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ATLANTA",
            inStock: true,
            variants: [
                { type: "แดง", price: 240 },
                { type: "เขียว", price: 240 }
            ],
            description: "ATLANTA บุหรี่ที่ให้ความรู้สึกแข็งแกร่งและมีสไตล์ เหมาะสำหรับผู้ที่ต้องการความแตกต่าง"
        },
        {
            baseName: "CAVALLO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAVALLO",
            inStock: true,
            variants: [
                { type: "ดำแดง", price: 230 },
                { type: "ดำน้ำเงิน", price: 230 }
            ],
            description: "CAVALLO มอบความหรูหราและรสชาติที่ลงตัว ให้คุณรู้สึกพิเศษในทุกคำสูบ"
        },
        {
            baseName: "235",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=235",
            inStock: true,
            variants: [
                { type: "แดง", price: 230 },
                { type: "เขียว", price: 230 }
            ],
            description: "บุหรี่ 235 รสชาติคลาสสิกที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "24",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=24",
            inStock: true,
            variants: [
                { type: "VXL", price: 230 },
                { type: "แดง", price: 230 }
            ],
            description: "บุหรี่ 24 ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "WALTON",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=WALTON",
            inStock: true,
            variants: [
                { type: "แดง (ใหญ่)", price: 230 },
                { type: "แดง (เล็ก)", price: 230 },
                { type: "เขียว (ใหญ่)", price: 230 },
                { type: "เขียว (เล็ก)", price: 230 }
            ],
            description: "WALTON บุหรี่ที่ให้ความรู้สึกนุ่มนวลและสบาย เหมาะสำหรับทุกช่วงเวลา"
        },
        {
            baseName: "MILANO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO",
            inStock: true,
            variants: [
                { type: "แดง", price: 230 }
            ],
            description: "MILANO มอบความหรูหราและรสชาติที่ลงตัว ให้คุณรู้สึกพิเศษในทุกคำสูบ"
        },
        {
            baseName: "MILANOTO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANOTO",
            inStock: true,
            variants: [
                { type: "Original", price: 240 }
            ],
            description: "MILANOTO รสชาติต้นตำรับที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "MILANO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+GOLD",
            inStock: true,
            variants: [
                { type: "ทอง", price: 240 },
                { type: "น้ำเงิน", price: 240 }
            ],
            description: "MILANO ทอง/น้ำเงิน ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "MILANO (แฟนตาซี)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+FANTASY",
            inStock: true,
            variants: [
                { type: "ทอง", price: 260 }
            ],
            description: "MILANO แฟนตาซี มอบประสบการณ์การสูบที่แปลกใหม่และน่าตื่นเต้น"
        },
        {
            baseName: "MILANO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+PURPLE",
            inStock: true,
            variants: [
                { type: "ม่วงแดง", price: 260 }
            ],
            description: "MILANO ม่วงแดง ให้ความรู้สึกที่แตกต่างและมีสไตล์ เหมาะสำหรับผู้ที่ต้องการความพิเศษ"
        },
        {
            baseName: "GM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GM",
            inStock: true,
            variants: [
                { type: "แดง", price: 230 }
            ],
            description: "GM บุหรี่ที่ให้ความรู้สึกมั่นคงและมีสไตล์ เหมาะสำหรับทุกโอกาส"
        },
        {
            baseName: "LM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=LM",
            inStock: true,
            variants: [
                { type: "แดง", price: 250 },
                { type: "เขียว", price: 250 }
            ],
            description: "LM บุหรี่ที่ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "LM 71",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=LM+71",
            inStock: true,
            variants: [
                { type: "แดง", price: 290 },
                { type: "เขียว", price: 290 }
            ],
            description: "LM 71 รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "CAPITAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAPITAL+RED+BLACK",
            inStock: true,
            variants: [
                { type: "แดงดำ", price: 240 }
            ],
            description: "CAPITAL แดงดำ บุหรี่ที่ให้ความรู้สึกมั่นคงและมีสไตล์ เหมาะสำหรับทุกโอกาส"
        },
        {
            baseName: "CAPITAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAPITAL+MULTI",
            inStock: true,
            variants: [
                { type: "แดง", price: 280 },
                { type: "เขียว", price: 280 },
                { type: "เหลือง", price: 280 }
            ],
            description: "CAPITAL หลากสี ให้รสชาติที่หลากหลายและน่าสนใจ เหมาะสำหรับผู้ที่ชอบความแตกต่าง"
        },
        {
            baseName: "GOLD MOUNT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GOLD+MOUNT",
            inStock: true,
            variants: [
                { type: "แดงส้ม", price: 270 },
                { type: "เขียวดำ", price: 270 },
                { type: "ดำส้ม", price: 270 }
            ],
            description: "GOLD MOUNT บุหรี่ที่ให้ความรู้สึกหรูหราและมีระดับ ด้วยกลิ่นอายคลาสสิก"
        },
        {
            baseName: "GOLD MOUNT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GOLD+MOUNT+ORANGE",
            inStock: true,
            variants: [
                { type: "แดงส้ม", price: 270 },
                { type: "ดำส้ม", price: 270 }
            ],
            description: "GOLD MOUNT รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "GOLD MOUNT (บางยี่ห้อ) B",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GOLD+MOUNT+BLACK+RED",
            inStock: true,
            variants: [
                { type: "ดำแดง", price: 260 }
            ],
            description: "GOLD MOUNT ดำแดง บุหรี่ที่ให้ความรู้สึกมั่นคงและมีสไตล์ เหมาะสำหรับทุกโอกาส"
        },
        {
            baseName: "VOXX",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VOXX",
            inStock: true,
            variants: [
                { type: "ดำ", price: 270 },
                { type: "แดง", price: 270 }
            ],
            description: "VOXX บุหรี่ที่มีสไตล์และรสชาติที่หลากหลาย ให้คุณเลือกตามอารมณ์"
        },
        {
            baseName: "TEXAS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=TEXAS",
            inStock: true,
            variants: [
                { type: "แดง", price: 260 },
                { type: "เขียว", price: 260 },
                { type: "ดำ", price: 260 },
                { type: "ทอง", price: 260 }
            ],
            description: "TEXAS บุหรี่ที่ให้ความรู้สึกแข็งแกร่งและมีสไตล์ เหมาะสำหรับผู้ที่ต้องการความแตกต่าง"
        },
        {
            baseName: "TEXAS 2",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=TEXAS2",
            inStock: true,
            variants: [
                { type: "แดง", price: 280 },
                { type: "เขียว", price: 280 },
                { type: "ดำ", price: 280 },
                { type: "ทอง", price: 280 }
            ],
            description: "TEXAS 2 รสชาติที่เข้มข้นขึ้น ให้ความรู้สึกที่แตกต่าง"
        },
        {
            baseName: "TEXAS DULY",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=TEXAS+DULY",
            inStock: true,
            variants: [
                { type: "แดง", price: 300 },
                { type: "ดำ", price: 300 }
            ],
            description: "TEXAS DULY มอบความหรูหราและรสชาติที่ลงตัวในทุกคำสูบ"
        },
        {
            baseName: "MARLBORO (ของแท้)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MARLBORO+AUTHENTIC",
            inStock: true,
            variants: [
                { type: "แดง", price: 250 },
                { type: "เขียว", price: 250 },
                { type: "ทอง", price: 250 }
            ],
            description: "MARLBORO ของแท้ รสชาติต้นตำรับที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "MARLBORO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MARLBORO+RED+BLUE",
            inStock: true,
            variants: [
                { type: "แดง", price: 320 },
                { type: "น้ำเงิน", price: 320 }
            ],
            description: "MARLBORO แดง/น้ำเงิน ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "PLATINUM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+BLACK+RED",
            inStock: true,
            variants: [
                { type: "ดำแดง", price: 250 }
            ],
            description: "PLATINUM ดำแดง บุหรี่ที่ให้ความรู้สึกมั่นคงและมีสไตล์ เหมาะสำหรับทุกโอกาส"
        },
        {
            baseName: "PLATINUM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+BLACK+RED2",
            inStock: true,
            variants: [
                { type: "ดำ", price: 250 },
                { type: "แดง", price: 250 }
            ],
            description: "PLATINUM ดำ/แดง ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "JOHN (ของปลอม)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=JOHN+FAKE",
            inStock: true,
            variants: [
                { type: "ดำ", price: 290 },
                { type: "เขียว", price: 290 }
            ],
            description: "JOHN ของปลอม รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "JOHN JOHN (ของแท้)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=JOHN+AUTHENTIC",
            inStock: true,
            variants: [
                { type: "ดำ", price: 320 },
                { type: "ขาว", price: 320 }
            ],
            description: "JOHN JOHN ของแท้ มอบความหรูหราและรสชาติที่ลงตัวในทุกคำสูบ"
        },
        {
            baseName: "ASTRO (ของปลอม)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ASTRO+FAKE",
            inStock: true,
            variants: [
                { type: "ดำ", price: 290 },
                { type: "แดง", price: 290 }
            ],
            description: "ASTRO ของปลอม รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "MOND INTERNATIONAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+INTERNATIONAL",
            inStock: true,
            variants: [
                { type: "Original", price: 260 }
            ],
            description: "MOND INTERNATIONAL บุหรี่ที่มีสไตล์และรสชาติที่หลากหลาย ให้คุณเลือกตามอารมณ์"
        },
        {
            baseName: "ทรงพิมพ์ ดำรูป (ของปลอม)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PRINTED+BLACK+FAKE",
            inStock: true,
            variants: [
                { type: "Original", price: 290 }
            ],
            description: "ทรงพิมพ์ ดำรูป ของปลอม รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "ทรงพิมพ์ (ของปลอม)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PRINTED+RED+FAKE",
            inStock: true,
            variants: [
                { type: "แดง", price: 280 }
            ],
            description: "ทรงพิมพ์ แดง ของปลอม รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "ทรงพิมพ์",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PRINTED+RED+GREEN",
            inStock: true,
            variants: [
                { type: "แดง", price: 280 },
                { type: "เขียว", price: 280 }
            ],
            description: "ทรงพิมพ์ แดง/เขียว ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "SMS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SMS",
            inStock: true,
            variants: [
                { type: "แดง", price: 290 },
                { type: "เขียว", price: 290 }
            ],
            description: "SMS บุหรี่ที่ให้ความรู้สึกนุ่มนวลและสบาย เหมาะสำหรับทุกช่วงเวลา"
        },
        {
            baseName: "WONDER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=WONDER",
            inStock: true,
            variants: [
                { type: "แดง", price: 290 },
                { type: "เขียว", price: 290 }
            ],
            description: "WONDER บุหรี่ที่ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "MEVIUS ORIGINAL BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MEVIUS+BLUE",
            inStock: true,
            variants: [
                { type: "Original", price: 340 }
            ],
            description: "MEVIUS ORIGINAL BLUE รสชาติต้นตำรับที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "ORION AZURE BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORION+AZURE",
            inStock: true,
            variants: [
                { type: "Original", price: 270 }
            ],
            description: "ORION AZURE BLUE ให้รสชาติที่กลมกล่อมและนุ่มนวล ชวนให้นึกถึงดวงดาวบนท้องฟ้า"
        },
        {
            baseName: "DENVER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+GREEN",
            inStock: true,
            variants: [
                { type: "เขียว", price: 330 }
            ],
            description: "DENVER เขียว ให้ความรู้สึกสดชื่นและเย็นสบาย เหมาะสำหรับวันที่ต้องการความสดใส"
        },
        {
            baseName: "DENVER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+RED",
            inStock: true,
            variants: [
                { type: "แดง", price: 270 }
            ],
            description: "DENVER แดง รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
        {
            baseName: "DENVER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+RED+BLUE",
            inStock: true,
            variants: [
                { type: "แดง", price: 300 },
                { type: "น้ำเงิน", price: 300 }
            ],
            description: "DENVER แดง/น้ำเงิน ให้ความรู้สึกสดชื่นและมีชีวิตชีวา เหมาะสำหรับวันที่ต้องการความกระปรี้กระเปร่า"
        },
        {
            baseName: "DENVER 2",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+GREEN2",
            inStock: true,
            variants: [
                { type: "เขียว", price: 270 }
            ],
            description: "DENVER เขียว 2 ให้ความรู้สึกสดชื่นและเย็นสบาย เหมาะสำหรับวันที่ต้องการความสดใส"
        },
        {
            baseName: "DENVER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+GREY",
            inStock: true,
            variants: [
                { type: "เทา", price: 330 }
            ],
            description: "DENVER เทา รสชาติเข้มข้นถึงใจ ให้ความรู้สึกอบอุ่นทุกครั้งที่สูบ"
        },
    ],
    "สายหวาน / สายช็อกโกแลต": [
        {
            baseName: "HARMONI",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=HARMONI",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 240 }
            ],
            description: "HARMONI บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "ASTON ABSOLUTE BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ASTON+BLUE",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 230 }
            ],
            description: "ASTON ABSOLUTE BLUE มอบความสดชื่นและรสชาติที่ลงตัว ให้คุณรู้สึกผ่อนคลาย"
        },
        {
            baseName: "ASTON GOLD MINT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ASTON+MINT",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 230 }
            ],
            description: "ASTON GOLD MINT ให้ความรู้สึกสดชื่นของมิ้นต์และรสชาติที่ลงตัว"
        },
        {
            baseName: "TOURO.",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=TOURO",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 280 }
            ],
            description: "TOURO บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "ISANSI INTERNATIONAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ISANSI",
            inStock: true,
            variants: [
                { type: "16 มวน", price: 260 }
            ],
            description: "ISANSI INTERNATIONAL มอบความหรูหราและรสชาติที่ลงตัวในทุกคำสูบ"
        },
        {
            baseName: "GAJAH HARU ORIGIN",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GAJAH+HARU",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 280 }
            ],
            description: "GAJAH HARU ORIGIN รสชาติต้นตำรับที่คุ้นเคย ให้ความรู้สึกอบอุ่นและสบาย"
        },
        {
            baseName: "RAIJAH MINT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=RAIJAH+MINT",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 300 }
            ],
            description: "RAIJAH MINT ให้ความรู้สึกสดชื่นของมิ้นต์และรสชาติที่ลงตัว"
        },
        {
            baseName: "CANYON",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CANYON+VANILLA",
            inStock: true,
            variants: [
                { type: "Vanilla", price: 340 }
            ],
            description: "CANYON Vanilla บุหรี่หวานกลิ่นวานิลลา ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "ZOOK",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ZOOK+LYCHEE",
            inStock: true,
            variants: [
                { type: "รส ลิ้นจี่", price: 370 }
            ],
            description: "ZOOK รสลิ้นจี่ ให้ความรู้สึกสดชื่นและหอมหวาน เหมาะสำหรับผู้ที่ชื่นชอบผลไม้"
        },
        {
            baseName: "ZOOK",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ZOOK+BLUEBERRY",
            inStock: true,
            variants: [
                { type: "รส บลูเบอร์รี่", price: 370 }
            ],
            description: "ZOOK รสบลูเบอร์รี่ ให้ความรู้สึกสดชื่นและหอมหวาน เหมาะสำหรับผู้ที่ชื่นชอบผลไม้"
        },
        {
            baseName: "VIBES",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VIBES+BANANA",
            inStock: true,
            variants: [
                { type: "รส กล้วยหอม", price: 220 }
            ],
            description: "VIBES รสกล้วยหอม ให้ความรู้สึกหอมหวานและนุ่มนวล เหมาะสำหรับผู้ที่ชื่นชอบกลิ่นผลไม้"
        },
        {
            baseName: "NEX THR33",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=NEX+THR33",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 220 }
            ],
            description: "NEX THR33 บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "NEOLITE BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=NEOLITE+BLUE",
            inStock: true,
            variants: [
                { type: "10 มวน", price: 230 }
            ],
            description: "NEOLITE BLUE มอบความสดชื่นและรสชาติที่ลงตัว ให้คุณรู้สึกผ่อนคลาย"
        },
        {
            baseName: "KINGS INTERNATIONAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=KINGS+INT",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 220 }
            ],
            description: "KINGS INTERNATIONAL บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "SURYA GUDANG GARAM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SURYA+GG",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 420 }
            ],
            description: "SURYA GUDANG GARAM บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "SURYA GUDANG GARAM (แพ็คแกะ)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SURYA+GG+PACK",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 650 }
            ],
            description: "SURYA GUDANG GARAM แพ็คแกะ บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "SURYA GUDANG GARAM (ซอง)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=SURYA+GG+PACKET",
            inStock: true,
            variants: [
                { type: "12 มวน", price: 380 }
            ],
            description: "SURYA GUDANG GARAM ซอง บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "GAMA GOLDEN PERMA",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GAMA+GOLDEN",
            inStock: true,
            variants: [
                { type: "10 มวน", price: 220 }
            ],
            description: "GAMA GOLDEN PERMA บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
        {
            baseName: "GUDANG GARAM PROFESSIONAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GUDANG+GG+PRO",
            inStock: true,
            variants: [
                { type: "16 มวน", price: 750 }
            ],
            description: "GUDANG GARAM PROFESSIONAL บุหรี่หวานกลิ่นหอม ให้ความรู้สึกผ่อนคลายและสบาย"
        },
    ],
    "สายเม็ดบีท / สายผลไม้": [
        {
            baseName: "ESSE CHANGE RED",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ESSE+RED",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 390 }
            ],
            description: "ESSE CHANGE RED บุหรี่เม็ดบีท รสชาติผลไม้ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ESSE CHANGE APPEL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ESSE+APPLE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 390 }
            ],
            description: "ESSE CHANGE APPEL บุหรี่เม็ดบีท รสแอปเปิ้ล ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ESSE CHANGE BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ESSE+BLUE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 390 }
            ],
            description: "ESSE CHANGE BLUE บุหรี่เม็ดบีท รสบลูเบอร์รี่ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ESSE DOUBLE SHOT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ESSE+DOUBLE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "ESSE DOUBLE SHOT บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ASTRO BLUEBERRY",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ASTRO+BLUEBERRY",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 370 }
            ],
            description: "ASTRO BLUEBERRY บุหรี่เม็ดบีท รสบลูเบอร์รี่ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "CANYON BLAST",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CANYON+BLAST",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 370 }
            ],
            description: "CANYON BLAST บุหรี่เม็ดบีท รสชาติผลไม้ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "DENVER",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DENVER+MIX",
            inStock: true,
            variants: [
                { type: "แดง (1 เม็ด)", price: 350 },
                { type: "ฟ้า (1 เม็ด)", price: 350 },
                { type: "บลูเบอร์รี่ (1 เม็ด)", price: 350 },
                { type: "ส้ม (1 เม็ด)", price: 350 }
            ],
            description: "DENVER บุหรี่เม็ดบีท รสชาติหลากหลาย ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ORION PURPLE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORION+PURPLE",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 370 }
            ],
            description: "ORION PURPLE บุหรี่เม็ดบีท รสชาติองุ่น ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ORIS PULSE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORIS+PULSE",
            inStock: true,
            variants: [
                { type: "ส้ม (1 เม็ด)", price: 350 },
                { type: "ฟ้า (1 เม็ด)", price: 350 },
                { type: "ชมพู (1 เม็ด)", price: 350 }
            ],
            description: "ORIS PULSE บุหรี่เม็ดบีท รสชาติหลากหลาย ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ORIS STRAWBERRY FUSION",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORIS+STRAWBERRY",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "ORIS STRAWBERRY FUSION บุหรี่เม็ดบีท รสสตรอว์เบอร์รี ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ORIS BLUEBERRY FUSION",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORIS+BLUEBERRY",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "ORIS BLUEBERRY FUSION บุหรี่เม็ดบีท รสบลูเบอร์รี่ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "ORIS TWIN SENSE BERRY MIX",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=ORIS+BERRY+MIX",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "ORIS TWIN SENSE BERRY MIX บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "GOLD MOUNT CHOCOLATE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=GOLD+MOUNT+CHOC",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "GOLD MOUNT CHOCOLATE บุหรี่เม็ดบีท รสช็อกโกแลต ให้ความหอมหวานและกลมกล่อม"
        },
        {
            baseName: "PLATINUM GOLD BERRY",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+GOLD+BERRY",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "PLATINUM GOLD BERRY บุหรี่เม็ดบีท รสเบอร์รี่ทอง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "PLATINUM BLUE RASP",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+BLUE+RASP",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "PLATINUM BLUE RASP บุหรี่เม็ดบีท รสบลูราสเบอร์รี่ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "PLATINUM COOL MINT",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+COOL+MINT",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "PLATINUM COOL MINT บุหรี่เม็ดบีท รสมิ้นต์เย็น ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "PLATINUM (แพ็คเขียว)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=PLATINUM+GREEN",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 300 }
            ],
            description: "PLATINUM แพ็คเขียว บุหรี่เม็ดบีท รสชาติเข้มข้น ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "CAPITAL",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAPITAL+MIX",
            inStock: true,
            variants: [
                { type: "แดง", price: 290 },
                { type: "เหลือง", price: 290 },
                { type: "บลูเบอร์รี่", price: 290 },
                { type: "ดับเบิลมินต์ทอง", price: 290 }
            ],
            description: "CAPITAL บุหรี่เม็ดบีท รสชาติหลากหลาย ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "JOHN MAX TWIN",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=JOHN+MAX+TWIN",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 310 }
            ],
            description: "JOHN MAX TWIN บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "JOHN",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=JOHN+BLUEBERRY",
            inStock: true,
            variants: [
                { type: "บลูเบอร์รี่ (2 เม็ด)", price: 310 }
            ],
            description: "JOHN บลูเบอร์รี่ บุหรี่เม็ดบีท รสบลูเบอร์รี่ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "JOHN",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=JOHN+GREEN",
            inStock: true,
            variants: [
                { type: "เขียว (2 เม็ด)", price: 310 }
            ],
            description: "JOHN เขียว บุหรี่เม็ดบีท รสเขียว ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "VESS CRUSH",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+CRUSH+1",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 280 }
            ],
            description: "VESS CRUSH บุหรี่เม็ดบีท รสชาติผลไม้ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "VESS CRUSH",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+CRUSH+2",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 310 }
            ],
            description: "VESS CRUSH 2 บุหรี่เม็ดบีท รสชาติผลไม้ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "VESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+BERRY+MIX",
            inStock: true,
            variants: [
                { type: "สตอเบอรี่ (2 เม็ด)", price: 300 },
                { type: "แดง (2 เม็ด)", price: 300 },
                { type: "ม่วง (2 เม็ด)", price: 300 }
            ],
            description: "VESS บุหรี่เม็ดบีท รสชาติหลากหลาย ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "VESS",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=VESS+RANDOM+MIX",
            inStock: true,
            variants: [
                { type: "สุ่ม (2 เม็ด)", price: 300 },
                { type: "ชมพู (2 เม็ด)", price: 300 },
                { type: "เขียวมิ้นต์ (2 เม็ด)", price: 300 }
            ],
            description: "VESS บุหรี่เม็ดบีท รสชาติสุ่ม ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "BLUE ICE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=BLUE+ICE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 300 }
            ],
            description: "BLUE ICE บุหรี่เม็ดบีท รสน้ำแข็ง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "BLUE ICE DOUBLE BLUE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=BLUE+ICE+DOUBLE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 380 }
            ],
            description: "BLUE ICE DOUBLE BLUE บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "RICHMAN SUPER SLIM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=RICHMAN+SLIM",
            inStock: true,
            variants: [
                { type: "มาลาเกีย (2 เม็ด)", price: 370 }
            ],
            description: "RICHMAN SUPER SLIM บุหรี่เม็ดบีท รสมาลาเกีย ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "RICHMAN DOUBLE CLICK",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=RICHMAN+DOUBLE",
            inStock: true,
            variants: [
                { type: "มาลาเกีย (2 เม็ด)", price: 380 }
            ],
            description: "RICHMAN DOUBLE CLICK บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "CAVALLO TWIN BARK",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=CAVALLO+PACK",
            inStock: true,
            variants: [
                { type: "แพ็คแกะ", price: 650 }
            ],
            description: "CAVALLO TWIN BARK บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MILANO KINGS RANDOM",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+RANDOM",
            inStock: true,
            variants: [
                { type: "1 เม็ดเล็ก", price: 350 }
            ],
            description: "MILANO KINGS RANDOM บุหรี่เม็ดบีท รสชาติสุ่ม ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MILANO GOLDEN GATE",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+GOLDEN",
            inStock: true,
            variants: [
                { type: "1 เม็ดเล็ก", price: 350 }
            ],
            description: "MILANO GOLDEN GATE บุหรี่เม็ดบีท รสชาติทอง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MILANO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MILANO+RED",
            inStock: true,
            variants: [
                { type: "แดง (2 เม็ด)", price: 380 }
            ],
            description: "MILANO แดง บุหรี่เม็ดบีท รสแดง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+ORIGINAL",
            inStock: true,
            variants: [
                { type: "ออริจินอล (2 เม็ด)", price: 380 }
            ],
            description: "MOND Original บุหรี่เม็ดบีท รสชาติต้นตำรับ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+GREEN",
            inStock: true,
            variants: [
                { type: "เขียว (2 เม็ด)", price: 380 }
            ],
            description: "MOND เขียว บุหรี่เม็ดบีท รสเขียว ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND (แถบสีแดง)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+RED+STRIPE",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 380 },
                { type: "2 เม็ด", price: 380 }
            ],
            description: "MOND แถบสีแดง บุหรี่เม็ดบีท รสชาติแดง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND (แถบสีน้ำเงิน)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+BLUE+STRIPE",
            inStock: true,
            variants: [
                { type: "1 เม็ด", price: 380 },
                { type: "2 เม็ด", price: 380 }
            ],
            description: "MOND แถบสีน้ำเงิน บุหรี่เม็ดบีท รสชาติน้ำเงิน ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND (แพ็คแดง)",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+RED+PACK",
            inStock: true,
            variants: [
                { type: "1 มวนเล็ก", price: 380 },
                { type: "2 เม็ด", price: 380 }
            ],
            description: "MOND แพ็คแดง บุหรี่เม็ดบีท รสชาติแดง ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MOND",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MOND+BLACK",
            inStock: true,
            variants: [
                { type: "สีดำ (2 เม็ด)", price: 400 }
            ],
            description: "MOND สีดำ บุหรี่เม็ดบีท รสชาติดำ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "DJ",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DJ",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 400 }
            ],
            description: "DJ บุหรี่เม็ดบีท รสชาติผลไม้ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "DJ DOUBLE SWITCH",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=DJ+DOUBLE",
            inStock: true,
            variants: [
                { type: "2 เม็ด", price: 400 }
            ],
            description: "DJ DOUBLE SWITCH บุหรี่เม็ดบีทสองรสชาติ ให้ความสดชื่นและกลิ่นหอม"
        },
        {
            baseName: "MARLBORO",
            img: "https://placehold.co/200x150/5B21B6/FFFFFF?text=MARLBORO+SKY",
            inStock: true,
            variants: [
                { type: "ฟ้า (1 เม็ด)", price: 420 }
            ],
            description: "MARLBORO ฟ้า บุหรี่เม็ดบีท รสชาติฟ้า ให้ความสดชื่นและกลิ่นหอม"
        },
    ]
};

// Define main categories for the category grid
const mainCategories = [
    { name: 'สายร้อน', icon: '🔥', description: 'รสชาติเข้มข้นถึงใจ' },
    { name: 'สายหวาน / สายช็อกโกแลต', icon: '🍫', description: 'หอมหวานนุ่มนวล' },
    { name: 'สายเม็ดบีท / สายผลไม้', icon: '🍇', description: 'สดชื่นกลิ่นผลไม้' }
];

/**
 * Initializes Intersection Observer for fade-in animations.
 */
function initializeIntersectionObserver() {
    const sections = document.querySelectorAll('.fade-in-section');
    const observerOptions = {
        root: null, // viewport as the root
        rootMargin: '0px',
        threshold: 0.1 // 10% of the element must be visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, observerOptions);

    // รีเช็คและอัปเดตสถานะสินค้าทั้งหมดในระบบก่อนทุกครั้ง
    // 1. สร้าง map สำหรับ lookup เงื่อนไขล่าสุดจาก parsed
    const statusMap = {};
    parsed.forEach((p) => {
        const s = (p.baseName + ' ' + (p.note||''));
        let status = '';
        if (/❌/.test(s)) {
            status = 'ของหมด';
        } else if (/ของเข้า.?แล้ว|ของเข้าแล้ว|ของเข้า/i.test(s)) {
            status = 'ของเข้าแล้ว';
        } else if (/📌/.test(s)) {
            status = 'จำกัดออเดอร์';
        } else {
            status = 'มี';
        }
        statusMap[p.baseName.trim()] = { status, parsed: p };
    });

    // 2. อัปเดตสินค้าทุกตัวใน products ให้ตรงกับ statusMap (ถ้ามี)
    for (const cat in products) {
        products[cat] = products[cat].map(prod => {
            const found = statusMap[prod.baseName?.trim()];
            if (found) {
                // ถ้าไม่ระบุราคา ใช้ราคาปัจจุบัน
                let variants = (found.parsed.variants||[]).map((v, idx) => {
                    let price = v.price;
                    if (!price && prod.variants && prod.variants[idx] && prod.variants[idx].price) {
                        price = prod.variants[idx].price;
                    }
                    return { ...v, price };
                });
                return {
                    ...prod,
                    ...found.parsed,
                    variants,
                    status: found.status
                };
            }
            return prod;
        });
    }

    // 3. เพิ่มสินค้าใหม่จาก parsed ที่ยังไม่มีใน products
    parsed.forEach((p) => {
        let found = null, foundCat = null;
        for (const cat in products) {
            found = products[cat]?.find(prod => prod.baseName && prod.baseName.trim() === p.baseName.trim());
            if (found) { foundCat = cat; break; }
        }
        if (!found) {
            const firstCat = Object.keys(products)[0];
            products[firstCat] = products[firstCat] || [];
            products[firstCat].push({ ...p, status: statusMap[p.baseName.trim()]?.status || 'มี' });
        }
    });

    // 4. อัปเดตสถานะในตะกร้า
    if (cart && cart.items) {
        cart.items.forEach(item => {
            const found = statusMap[item.baseName?.trim()];
            if (found) {
                if (found.status === 'ของหมด') {
                    item.status = 'ของหมด';
                } else if (found.status === 'จำกัดออเดอร์') {
                    item.status = 'จำกัดสินค้า';
                } else if (found.status === 'ของเข้าแล้ว') {
                    item.status = 'ของเข้าแล้ว';
                } else {
                    item.status = '';
                }
                // อัปเดตราคาในตะกร้าด้วย ถ้าเปลี่ยน
                if (item.variantIdx != null && found.parsed.variants && found.parsed.variants[item.variantIdx] && found.parsed.variants[item.variantIdx].price) {
                    item.price = found.parsed.variants[item.variantIdx].price;
                }
            }
        });
    }

    renderAdminProductListByCategory();
    renderProducts();
    updateCartDisplay();
    const searchInput = document.getElementById('searchInput');
    if (isDarkMode) {
        searchInput.classList.add('bg-gray-800', 'text-white', 'placeholder-gray-400');
        searchInput.classList.remove('bg-white', 'text-gray-800', 'placeholder-gray-600', 'border', 'border-gray-300');
    } else {
        searchInput.classList.add('bg-white', 'text-gray-800', 'placeholder-gray-600', 'border', 'border-gray-300');
        searchInput.classList.remove('bg-gray-800', 'text-white', 'placeholder-gray-400');
    }

    // Update main content background/text
    const mainContent = document.getElementById('main-content');
    if (isDarkMode) {
        mainContent.classList.add('dark-mode-bg', 'text-gray-100');
        mainContent.classList.remove('light-mode-bg-white', 'text-gray-800');
    } else {
        mainContent.classList.add('light-mode-bg-white', 'text-gray-800');
        mainContent.classList.remove('dark-mode-bg', 'text-gray-100');
    }

    // Update footer background/text
    const footer = document.querySelector('footer');
    if (isDarkMode) {
        footer.classList.add('dark-mode-bg', 'text-gray-400');
        footer.classList.remove('light-mode-bg-lightgray', 'text-gray-600');
    } else {
        footer.classList.add('light-mode-bg-lightgray', 'text-gray-800');
        footer.classList.remove('dark-mode-bg', 'text-gray-400');
    }

    // Update social media icons for dark/light mode
    document.querySelectorAll('footer img').forEach(img => {
        if (isDarkMode) {
            img.classList.add('filter', 'invert');
            img.classList.remove('dark:filter-none'); // Remove light mode specific filter
        } else {
            img.classList.remove('filter', 'invert');
            img.classList.add('dark:filter-none'); // Add light mode specific filter (which means no invert)
        }
    });
}


/**
 * Renders the main product category grid.
 */
function renderMainCategoryGrid() {
    const categoryGridDiv = document.getElementById('categoryGrid');
    categoryGridDiv.innerHTML = ''; // Clear existing

    mainCategories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'product-card p-6 text-center cursor-pointer'; // Reuse product-card styling
        card.onclick = () => selectCategory(category.name);
        card.innerHTML = `
            <div class="text-5xl mb-4">${category.icon}</div>
            <h4 class="text-2xl font-bold mb-2">${category.name}</h4>
            <p class="text-gray-400">${category.description}</p>
            <button class="mt-4 btn-info px-4 py-2 rounded-full text-sm">ดูสินค้า</button>
        `;
        categoryGridDiv.appendChild(card);
    });
}

/**
 * Renders the category tabs dynamically based on the 'products' data.
 * Adds an "All" tab and individual category tabs.
 */
function renderCategoryTabs() {
    const categoryTabsDiv = document.getElementById('categoryTabs');
    categoryTabsDiv.innerHTML = ''; // Clear existing tabs

    // Create and append "All" tab
    const allTab = document.createElement('div');
    allTab.className = 'category-tab active'; // 'active' by default
    allTab.innerText = 'ทั้งหมด';
    allTab.onclick = () => selectCategory('ทั้งหมด');
    categoryTabsDiv.appendChild(allTab);

    // Create and append tabs for each product category
    for (const category in products) {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.innerText = category;
        tab.onclick = () => selectCategory(category);
        categoryTabsDiv.appendChild(tab);
    }
}

/**
 * Selects a category, updates the active tab, and re-renders products.
 * @param {string} categoryName - The name of the category to select.
 */
function selectCategory(categoryName) {
    currentCategory = categoryName;

    // Update active class on tabs
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        if (tab.innerText === categoryName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    renderProducts(); // Re-render products for the selected category
    document.getElementById('searchInput').value = ''; // Clear search input
}

/**
 * Renders product cards based on the currently selected category and search filter.
 */
function renderProducts() {
    const productGridDiv = document.getElementById("productGrid");
    productGridDiv.innerHTML = ""; // Clear existing products

    let productsToDisplay = [];
    // If "All" category is selected, combine products from all categories
    if (currentCategory === 'ทั้งหมด') {
        for (const category in products) {
            products[category].forEach(p => productsToDisplay.push({ ...p, category: category }));
        }
    } else {
        // Otherwise, display products from the selected category
        productsToDisplay = products[currentCategory] || [];
        productsToDisplay = productsToDisplay.map(p => ({ ...p, category: currentCategory }));
    }

    // Create and append product cards to the grid
    productsToDisplay.forEach((product, index) => {
        const productCard = document.createElement("div");
        // กำหนด class และ click listener ตามสถานะจริง
    let isOutOfStock = product.status === 'ของหมด' || product.status === '❌ ของหมด';
    let isLimited = product.status === 'จำกัดออเดอร์' || product.status === 'จำกัดสินค้า';
    let isRestocked = product.status === 'ของเข้าแล้ว';
    let isAvailable = product.status === 'มี';
        productCard.className = `product-card p-4 rounded shadow-lg hover:shadow-xl ${isOutOfStock ? 'out-of-stock' : 'cursor-pointer'}`;
        productCard.setAttribute("data-base-name", product.baseName);
        productCard.setAttribute("data-category", product.category);
        if (!isOutOfStock) {
            productCard.onclick = () => showProductDetail(product);
        }

        let variantOptionsHtml = '';
        if (product.variants && product.variants.length > 1) {
            variantOptionsHtml = `
                <select id="variant-select-${index}" class="w-full p-2 rounded mt-2 focus:outline-none focus:ring-2 focus:ring-red-500 dark-mode-bg-gray-800 dark-mode-text-white light-mode-bg-gray-100 light-mode-text-gray-800" ${product.inStock ? '' : 'disabled'}>
                    ${product.variants.map(variant => `<option value="${variant.type}|${variant.price}">${variant.type} (${variant.price} บาท)</option>`).join('')}
                </select>
            `;
        } else if (product.variants && product.variants.length === 1) {
            variantOptionsHtml = `
                <p class="mt-1 dark-mode-text-gray-300 light-mode-text-gray-700">ชนิด: ${product.variants[0].type !== "Original" ? product.variants[0].type : ''}</p>
                <p class="mt-1 dark-mode-text-gray-300 light-mode-text-gray-700">ราคา: ${product.variants[0].price} บาท</p>
            `;
        } else {
            variantOptionsHtml = `<p class="mt-1 dark-mode-text-gray-300 light-mode-text-gray-700">ราคา: N/A</p>`;
        }

        // สถานะสินค้า (ใช้ product.status จาก logic bulk/check เป็นหลัก)
        let statusText = '';
        if (isOutOfStock) {
            statusText = '<span class="text-red-500 font-bold ml-2">สินค้าหมด <a href="#" class="underline text-xs text-blue-400 ml-1" title="ดูรายละเอียด">ดูข้อมูล</a></span>';
        } else if (isLimited) {
            statusText = '<span class="text-yellow-500 font-bold ml-2">จำกัดออเดอร์</span>';
        } else if (isRestocked) {
            statusText = '<span class="text-green-600 font-bold ml-2">ของเข้าแล้ว</span>';
        } else if (isAvailable) {
            statusText = '<span class="text-green-500 font-bold ml-2">ของมี <a href="#" class="underline text-xs text-blue-400 ml-1" title="ดูรายละเอียด">ดูข้อมูล</a></span>';
        }

        productCard.innerHTML = `
            <img src="${product.img}" alt="${product.baseName}" class="w-full rounded mb-3" onerror="this.onerror=null;this.src='https://placehold.co/200x150/333333/FFFFFF?text=No+Image';" />
            <h3 class="text-xl font-semibold dark-mode-text-white light-mode-text-gray-900">${product.baseName}${statusText}</h3>
            ${variantOptionsHtml}
            ${isOutOfStock ? `
                <div class="out-of-stock-overlay">
                    <span class="pulse-text">สินค้าหมด</span>
                </div>
                <button disabled class="mt-3 w-full bg-gray-500 text-white py-2 rounded cursor-not-allowed">สินค้าหมด</button>
            ` : isLimited ? `
                <div class="out-of-stock-overlay">
                    <span class="pulse-text">จำกัดออเดอร์</span>
                </div>
                <button disabled class="mt-3 w-full bg-yellow-500 text-white py-2 rounded cursor-not-allowed">จำกัดออเดอร์</button>
            ` : isRestocked ? `
                <button onclick="event.stopPropagation(); addToCartFromCard(${index})" class="mt-3 w-full btn-primary py-2 rounded">เพิ่มลงตะกร้า</button>
            ` : `
                <button onclick="event.stopPropagation(); addToCartFromCard(${index})" class="mt-3 w-full btn-primary py-2 rounded">เพิ่มลงตะกร้า</button>
            `}
        `;
        productGridDiv.appendChild(productCard);
    });

    filterProducts(); // Apply search filter after rendering products
}

/**
 * Adds a product (with selected variant) to the cart.
 * This function is called from the "Add to Cart" button on product cards.
 * @param {number} productIndex - The index of the product in the currently displayed productsToDisplay array.
 */
function addToCartFromCard(productIndex) {
    let productsToDisplay = [];
    if (currentCategory === 'ทั้งหมด') {
        for (const category in products) {
            products[category].forEach(p => productsToDisplay.push({ ...p, category: category }));
        }
    } else {
        productsToDisplay = products[currentCategory] || [];
        productsToDisplay = productsToDisplay.map(p => ({ ...p, category: currentCategory }));
    }

    const product = productsToDisplay[productIndex];

    // Prevent adding to cart if out of stock
    if (!product.inStock) {
        showAlertDialog('สินค้าหมด', `"${product.baseName}" หมดสต็อกแล้ว ไม่สามารถเพิ่มลงตะกร้าได้`);
        return;
    }

    let selectedVariantType = '';
    let selectedVariantPrice = 0;
    let fullProductName = product.baseName;

    if (product.variants.length > 1) {
        const selectElement = document.getElementById(`variant-select-${productIndex}`);
        const [type, price] = selectElement.value.split('|');
        selectedVariantType = type;
        selectedVariantPrice = parseFloat(price);
        fullProductName = `${product.baseName} (${selectedVariantType})`;
    } else if (product.variants.length === 1) {
        selectedVariantType = product.variants[0].type;
        selectedVariantPrice = product.variants[0].price;
        if (selectedVariantType !== "Original") {
            fullProductName = `${product.baseName} (${selectedVariantType})`;
        }
    } else {
        // Should not happen with the new data structure
        showAlertDialog('ข้อผิดพลาด', 'ไม่พบข้อมูลชนิดสินค้า');
        return;
    }

    const existingItem = cart.find(item => item.fullProductName === fullProductName);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            baseName: product.baseName,
            variantType: selectedVariantType,
            price: selectedVariantPrice,
            fullProductName: fullProductName, // Store the full name for display
            quantity: 1
        });
    }
    updateCartDisplay(); // Update cart UI
    showToast(`🛒 "${fullProductName}" ถูกเพิ่มในตะกร้าแล้ว!`, 'success'); // Show a success toast notification
}


/**
 * Displays a temporary toast notification at the top right of the screen.
 * @param {string} message - The message to display in the toast.
 * @param {string} type - The type of toast ('success', 'error', 'warning', 'info')
 * @param {number} timeout - How long to show the toast in milliseconds
 */
function showToast(message, type = 'info', timeout = 3000) {
    const toast = document.createElement('div');
    
    // Set background color based on type
    let bgColor = 'bg-gray-800';
    if (type === 'success') bgColor = 'bg-green-600';
    else if (type === 'error') bgColor = 'bg-red-600';
    else if (type === 'warning') bgColor = 'bg-yellow-600';
    else if (type === 'info') bgColor = 'bg-blue-600';
    
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-[9999] opacity-0 transition-opacity duration-300`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate toast in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);

    // Animate toast out and remove after the specified timeout
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => toast.remove());
    }, timeout);
}

/**
 * Calculate shipping cost based on total quantity in cart
 */
function calculateShippingCost(totalQuantity) {
    if (totalQuantity <= SHIPPING_COSTS.SINGLE.max) {
        return SHIPPING_COSTS.SINGLE.cost;
    } else if (totalQuantity <= SHIPPING_COSTS.SMALL.max) {
        return SHIPPING_COSTS.SMALL.cost;
    } else if (totalQuantity <= SHIPPING_COSTS.MEDIUM.max) {
        return SHIPPING_COSTS.MEDIUM.cost;
    }
    return SHIPPING_COSTS.MEDIUM.cost; // Default to medium cost for large orders
}

/**
 * Updates the quantity of an item in the cart or removes it if quantity is 0 or less.
 * @param {number} index - The index of the item in the cart array.
 * @param {number} newQuantity - The new quantity for the item.
 */
function updateCartItemQuantity(index, newQuantity) {
    if (newQuantity <= 0) {
        cart.splice(index, 1); // Remove item if quantity is 0 or less
        showToast('ลบสินค้าออกจากตะกร้าแล้ว', 'info');
    } else {
        cart[index].quantity = newQuantity; // Update quantity
        showToast('อัปเดตจำนวนสินค้าแล้ว', 'success');
    }
    saveCart(); // Persist changes to localStorage
    updateCartDisplay(); // Re-render cart UI
}

// Cart State Management
const CART_STORAGE_KEY = 'nobinShopCart';
const SHIPPING_COSTS = {
    SINGLE: { max: 1, cost: 50 },
    SMALL: { min: 2, max: 9, cost: 80 },
    MEDIUM: { min: 10, max: 24, cost: 100 }
};

let cart = [];

// Initialize cart system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadCart();
        
        // Set up cart toggle listeners
        const cartButtons = document.querySelectorAll('[data-cart-toggle]');
        cartButtons.forEach(button => {
            button.addEventListener('click', toggleCart);
        });

        console.log('Cart system initialized successfully');
    } catch (error) {
        console.error('Error initializing cart system:', error);
    }
});

/**
 * Load cart data from localStorage and update UI
 */
function loadCart() {
    try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        cart = savedCart ? JSON.parse(savedCart) : [];
        updateCartUI();
    } catch (error) {
        console.error('Error loading cart:', error);
        cart = [];
        updateCartUI();
    }
}

/**
 * Save cart to localStorage
 */
function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Error saving cart:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึกตะกร้า', 'error');
    }
}

/**
 * Updates the display of items in the cart modal, total price, and item count.
 */
/**
 * Updates the quantity of an item in the cart
 * @param {number} index - The index of the item in the cart array
 * @param {number} newQuantity - The new quantity to set
 */
function updateItemQuantity(index, newQuantity) {
    if (newQuantity <= 0) {
        cart.splice(index, 1); // Remove item if quantity is 0
    } else {
        cart[index].quantity = newQuantity;
    }
    updateCartDisplay();
    saveCartToLocalStorage();
}

function showShippingForm() {
    const cartFooter = document.getElementById('cartFooter');
    const shippingForm = document.getElementById('shippingForm');
    const formCartTotal = document.getElementById('formCartTotal');
    const cartTotal = document.getElementById('cartTotal');

    // คัดลอกยอดรวมไปที่ฟอร์ม
    formCartTotal.textContent = cartTotal.textContent;

    // ซ่อนส่วน footer ของตะกร้า และแสดงฟอร์ม
    cartFooter.classList.add('hidden');
    shippingForm.classList.remove('hidden');
}

function cancelOrder() {
    const cartFooter = document.getElementById('cartFooter');
    const shippingForm = document.getElementById('shippingForm');

    // ซ่อนฟอร์มและแสดงส่วน footer ของตะกร้า
    shippingForm.classList.add('hidden');
    cartFooter.classList.remove('hidden');
}

function formatFullAddress() {
    const addressLine1 = document.getElementById('addressLine1').value.trim();
    const street = document.getElementById('addressStreet').value.trim();
    const subdistrict = document.getElementById('addressSubdistrict').value.trim();
    const district = document.getElementById('addressDistrict').value.trim();
    const province = document.getElementById('addressProvince').value.trim();
    const zipcode = document.getElementById('addressZipcode').value.trim();

    // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!addressLine1 || !subdistrict || !district || !province || !zipcode) {
        return null;
    }

    // สร้างที่อยู่เต็มรูปแบบ
    let fullAddress = addressLine1;
    if (street) fullAddress += ` ถนน${street}`;
    fullAddress += ` ตำบล${subdistrict} อำเภอ${district} จังหวัด${province} ${zipcode}`;

    return fullAddress;
}

function confirmOrder() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const fullAddress = formatFullAddress();

    // ตรวจสอบการกรอกข้อมูล
    if (!customerName || !customerPhone || !fullAddress) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }

    // บันทึกที่อยู่เต็มรูปแบบลงใน input hidden
    document.getElementById('customerAddress').value = fullAddress;

    // ตรวจสอบรูปแบบเบอร์โทรศัพท์
    if (!/^[0-9]{10}$/.test(customerPhone)) {
        showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)', 'error');
        return;
    }

    // แสดงการยืนยันการสั่งซื้อ
    showAlertDialog(
        'ยืนยันการสั่งซื้อ',
        `กรุณาตรวจสอบข้อมูลการสั่งซื้อ:
        
        ชื่อ-นามสกุล: ${customerName}
        เบอร์โทรศัพท์: ${customerPhone}
        ที่อยู่: ${customerAddress}
        
        ยอดรวม: ${document.getElementById('formCartTotal').textContent}
        
        กดตกลงเพื่อยืนยันการสั่งซื้อ`,
        () => {
            // ดำเนินการสั่งซื้อ
            submitOrder({
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
                items: cart,
                total: document.getElementById('formCartTotal').textContent
            });
        }
    );
}

function updateCartDisplay() {
    const cartItems = document.getElementById("cartItems");
    const cartItemCount = document.getElementById("cartItemCount");
    const floatingCartItemCount = document.getElementById("floatingCartItemCount");
    const cartTotalElement = document.getElementById("cartTotal");
    let total = 0;
    let itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (!cartItems || !cartItemCount) {
        console.error('Cart elements not found');
        return;
    }

    // Update cart badges count with animation
    cartItemCount.textContent = itemCount.toString();
    if (floatingCartItemCount) {
        floatingCartItemCount.textContent = itemCount.toString();
    }
    
    if (itemCount > 0) {
        cartItemCount.classList.remove('opacity-0', 'scale-0');
        cartItemCount.classList.add('opacity-100', 'scale-100');
        if (floatingCartItemCount) {
            floatingCartItemCount.classList.remove('opacity-0', 'scale-0');
            floatingCartItemCount.classList.add('opacity-100', 'scale-100');
        }
    } else {
        cartItemCount.classList.add('opacity-0', 'scale-0');
        cartItemCount.classList.remove('opacity-100', 'scale-100');
        if (floatingCartItemCount) {
            floatingCartItemCount.classList.add('opacity-0', 'scale-0');
            floatingCartItemCount.classList.remove('opacity-100', 'scale-100');
        }
    }

    cartItems.innerHTML = ""; // Clear existing items

    if (!Array.isArray(cart) || cart.length === 0) {
        cartItems.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-gray-500">
                <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p>ตะกร้าว่างเปล่า</p>
            </div>`;
    } else {
        cart.forEach((item, idx) => {
            if (!item.price || !item.quantity) return;
            
            total += item.price * item.quantity;
            const div = document.createElement("div");
            div.className = "flex items-center justify-between p-4 border-b dark:border-gray-700";
            
            div.innerHTML = `
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-900 dark:text-gray-100">${item.fullProductName}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        ${item.price.toLocaleString()} บาท
                    </p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="updateItemQuantity(${idx}, 0)" class="ml-2 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full" title="ลบสินค้า">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center border rounded-lg overflow-hidden">
                        <button onclick="updateCartItemQuantity(${idx}, ${item.quantity - 1})" 
                                class="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                            -
                        </button>
                        <span class="px-3 py-1 border-x">${item.quantity}</span>
                        <button onclick="updateCartItemQuantity(${idx}, ${item.quantity + 1})"
                                class="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                            +
                        </button>
                    </div>
                    <span class="font-semibold w-24 text-right">${(item.price * item.quantity).toLocaleString()} บาท</span>
                </div>
            `;
            cartItems.appendChild(div);
        });
    }

    // Update total price
    const totalDisplay = document.getElementById("cartTotal");
    if (totalDisplay) {
        totalDisplay.innerText = `${total.toLocaleString()} บาท`;
    }

    // Update cart counter badge
    cartItemCount.innerText = itemCount;
    cartItemCount.classList.toggle('hidden', itemCount === 0);

    // Update notification count in header
    const notificationCount = document.getElementById('notificationCount');
    if (itemCount > 0) {
        notificationCount.innerText = itemCount;
        notificationCount.classList.remove('hidden');
        notificationCount.classList.add('animate-bounce'); // Add bounce animation
    } else {
        notificationCount.classList.add('hidden');
        notificationCount.classList.remove('animate-bounce');
    }
}

/**
 * Toggles the visibility of the cart modal.
 */
function toggleCart() {
    try {
        const cartModal = document.getElementById("cartModal");
        const cartContent = document.getElementById("cartContent");
        
        if (!cartModal || !cartContent) {
            console.error('Cart modal elements not found');
            return;
        }

        const isHidden = cartModal.classList.contains("hidden");
        
        if (isHidden) {
            // Show cart
            cartModal.classList.remove("hidden");
            cartModal.classList.add("flex");
            // Animate content in
            setTimeout(() => {
                cartContent.style.transform = 'translateX(0)';
            }, 10);
        } else {
            // Animate content out
            cartContent.style.transform = 'translateX(100%)';
            // Hide cart after animation
            setTimeout(() => {
                cartModal.classList.add("hidden");
                cartModal.classList.remove("flex");
            }, 300);
        }

        // Update cart display when showing
        if (isHidden) {
            updateCartDisplay();
        }
    } catch (error) {
        console.error('Error toggling cart:', error);
        showToast('เกิดข้อผิดพลาดในการแสดงตะกร้า', 'error');
    }
}

/**
 * Filters product cards based on the search input and current category.
 */
function filterProducts() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const productCards = document.querySelectorAll('#productGrid .product-card'); // Target only main product grid

    productCards.forEach(card => {
        const baseName = card.getAttribute('data-base-name').toLowerCase();
        const category = card.getAttribute('data-category');
        // Check if any variant type matches the search input
        const variantSelect = card.querySelector('select');
        let variantMatches = false;
        if (variantSelect) {
            Array.from(variantSelect.options).forEach(option => {
                if (option.textContent.toLowerCase().includes(input)) {
                    variantMatches = true;
                }
            });
        } else {
            // For single-variant products, check the displayed type if it exists
            const typeText = card.querySelector('p:nth-of-type(1)')?.textContent.toLowerCase();
            if (typeText && typeText.includes(input)) {
                variantMatches = true;
            }
        }

        const isVisibleBySearch = baseName.includes(input) || variantMatches;
        const isVisibleByCategory = (currentCategory === 'ทั้งหมด' || category === currentCategory);

        card.style.display = (isVisibleBySearch && isVisibleByCategory) ? 'block' : 'none';
    });
}

/**
 * Transitions from the cart modal to the checkout modal.
 * Shows an alert if the cart is empty.
 */
function goToCheckout() {
    if (cart.length === 0) {
        showAlertDialog('ตะกร้าว่าง', 'กรุณาเพิ่มสินค้าก่อนดำเนินการสั่งซื้อ'); // Use custom alert
        return;
    }
    const cartModal = document.getElementById("cartModal");
    cartModal.classList.add("hidden");
    cartModal.classList.remove("flex");

    const checkoutModal = document.getElementById("checkoutModal");
    checkoutModal.classList.remove("hidden");
    checkoutModal.classList.add("flex");

    populateCheckoutSummary(); // Populate checkout summary when opening
}

/**
 * Toggles the visibility of the checkout modal.
 */
function toggleCheckoutModal() {
    const checkoutModal = document.getElementById("checkoutModal");
    if (checkoutModal.classList.contains("hidden")) {
        checkoutModal.classList.remove("hidden");
        checkoutModal.classList.add("flex");
    } else {
        checkoutModal.classList.add("hidden");
        checkoutModal.classList.remove("flex");
    }
}

/**
 * Populates the order summary list in the checkout modal.
 */
function populateCheckoutSummary() {
    const checkoutSummaryList = document.getElementById('checkoutSummaryList');
    const checkoutTotalSpan = document.getElementById('checkoutTotal');
    let total = 0;
    let totalCots = 0; // To calculate total number of cots

    // Calculate total cots
    cart.forEach(item => {
        totalCots += item.quantity;
    });

    checkoutSummaryList.innerHTML = ''; // Clear existing summary items
    cart.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center summary-item';
        li.innerHTML = `
            <span>${item.fullProductName} x ${item.quantity}</span>
            <span>${(item.price * item.quantity).toLocaleString()} บาท</span>
        `;
        checkoutSummaryList.appendChild(li);
        total += item.price * item.quantity;
    });

    // Calculate shipping cost based on payment method and total cots
    const shippingMethod = document.querySelector('input[name="shippingMethod"]:checked')?.value;
    let shippingCost = 0;

    if (shippingMethod === 'standard') { // Standard shipping
        if (totalCots >= 1 && totalCots <= 2) {
            shippingCost = 40;
        } else if (totalCots >= 3 && totalCots <= 9) {
            shippingCost = 50;
        } else if (totalCots >= 10 && totalCots <= 24) {
            shippingCost = 60;
        }
    } else if (shippingMethod === 'ems') { // COD shipping
        if (totalCots === 1) {
            shippingCost = 50;
        } else if (totalCots >= 2 && totalCots <= 9) {
            shippingCost = 80;
        } else if (totalCots >= 10 && totalCots <= 24) {
            shippingCost = 100;
        }
    }

    if (shippingCost > 0) {
        const shippingLi = document.createElement('li');
        shippingLi.className = 'flex justify-between items-center text-red-400 font-semibold border-t border-gray-700 pt-2 mt-2 summary-item';
        shippingLi.innerHTML = `
            <span>ค่าจัดส่ง (${shippingMethod === 'standard' ? 'Standard' : 'เก็บเงินปลายทาง'})</span>
            <span>${shippingCost} บาท</span>
        `;
        checkoutSummaryList.appendChild(shippingLi);
    } else if (totalCots > 24) {
        // Handle cases where total cots exceed the defined ranges
        const shippingLi = document.createElement('li');
        shippingLi.className = 'flex justify-between items-center text-red-400 font-semibold border-t border-gray-700 pt-2 mt-2 summary-item';
        shippingLi.innerHTML = `
            <span>ค่าจัดส่ง (กรุณาติดต่อร้านค้า)</span>
            <span>N/A</span>
        `;
        checkoutSummaryList.appendChild(shippingLi);
    }

    total += shippingCost;
    checkoutTotalSpan.innerText = total.toLocaleString(); // Format total with commas
}

/**
 * Toggles the visibility of bank transfer details based on payment method selection.
 * This function is now simplified as bank transfer details are removed.
 */
function togglePaymentDetails() {
    // No action needed as bank transfer details are removed.
    // This function is kept for compatibility if other payment methods were to be added later.
}

/**
 * Displays a custom alert dialog.
 * @param {string} title - The title of the alert.
 * @param {string} message - The message content of the alert.
 * @param {function} [confirmCallback=null] - Callback function for confirmation.
 * @param {boolean} [isConfirm=false] - True if it's a confirmation dialog.
 */
function showAlertDialog(title, message, confirmCallback = null, isConfirm = false) {
    const alertDialog = document.getElementById('customAlertDialog');
    document.getElementById('alertDialogTitle').innerText = title;
    document.getElementById('alertDialogMessage').innerText = message;
    const confirmButton = alertDialog.querySelector('button');

    // Clear previous event listeners
    confirmButton.onclick = null;

    if (isConfirm && confirmCallback) {
        // Change button text to "ยืนยัน" and add a cancel button
        confirmButton.innerText = 'ยืนยัน';
        confirmButton.classList.remove('btn-primary', 'bg-red-600', 'hover:bg-red-700');
        confirmButton.classList.add('btn-success');

        const cancelButton = document.createElement('button');
        cancelButton.innerText = 'ยกเลิก';
        cancelButton.className = 'btn-secondary px-6 py-2 rounded-lg text-lg font-semibold transition duration-200 ease-in-out ml-4';
        cancelButton.onclick = () => closeAlertDialog();
        confirmButton.parentNode.appendChild(cancelButton); // Add cancel button next to confirm

        confirmButton.onclick = () => {
            confirmCallback();
            if (cancelButton.parentNode) {
                cancelButton.parentNode.removeChild(cancelButton); // Remove cancel button after action
            }
        };
    } else {
        // Default "OK" button behavior
        confirmButton.innerText = 'ตกลง';
        confirmButton.classList.remove('btn-success');
        confirmButton.classList.add('btn-primary');
        confirmButton.onclick = () => closeAlertDialog();
        // Ensure no extra cancel button is present
        const existingCancelButton = confirmButton.parentNode.querySelector('.btn-secondary');
        if (existingCancelButton) {
            existingCancelButton.remove();
        }
    }

    alertDialog.classList.remove('hidden');
    alertDialog.classList.add('flex');
}

/**
 * Closes the custom alert dialog.
 */
function closeAlertDialog() {
    const alertDialog = document.getElementById('customAlertDialog');
    alertDialog.classList.add('hidden');
    alertDialog.classList.remove('flex');
}

/**
 * Handles the submission of the order form.
 * Performs client-side validation and sends data to Google Apps Script.
 */
async function submitOrder() {
    const form = document.getElementById('checkoutForm');

    // Basic client-side form validation
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Get cart items from localStorage
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cartItems.length === 0) {
        showAlertDialog('ข้อผิดพลาด', 'กรุณาเพิ่มสินค้าในตะกร้าก่อนสั่งซื้อ');
        return;
    }

    try {
        showToast('กำลังส่งคำสั่งซื้อ...', 'info');

        // Prepare order details
        const orderDetails = {
            customerName: document.getElementById('customerName').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            customerAddress: document.getElementById('customerAddress').value.trim(),
            shippingMethod: document.querySelector('input[name="shippingMethod"]:checked').value,
            paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
            items: cartItems,
            totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        // Get receipt file if payment method is bank transfer
        const bankSlip = document.getElementById('bankSlip');
        if (orderDetails.paymentMethod === 'bank_transfer') {
            if (!bankSlip.files[0]) {
                showAlertDialog('ข้อผิดพลาด', 'กรุณาแนบสลิปการโอนเงิน');
                return;
            }

            // Convert receipt to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve({
                        data: base64,
                        mimeType: bankSlip.files[0].type,
                        name: bankSlip.files[0].name
                    });
                };
                reader.readAsDataURL(bankSlip.files[0]);
            });
            orderDetails.receipt = await base64Promise;
        }

        // Send order to Google Apps Script
        const response = await fetch(API_CONFIG.WEBAPP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderDetails)
        });

        const result = await response.json();

        if (result.success) {
            // Clear cart and form
            localStorage.setItem('cart', '[]');
            syncCartUI();
            form.reset();
            toggleCheckoutModal();
            
            // Show success message
            showAlertDialog(
                '🎉 สั่งซื้อสำเร็จ!',
                `คำสั่งซื้อหมายเลข ${result.orderNumber} ได้รับการบันทึกแล้ว\nทางร้านจะติดต่อกลับไปที่เบอร์ ${orderDetails.customerPhone} โดยเร็วที่สุด`
            );
        } else {
            throw new Error(result.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        showAlertDialog('❌ ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
    }

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            body: formData // FormData handles multipart/form-data for file uploads
        });

        const result = await response.json();

        if (result.status === 'SUCCESS') {
            showAlertDialog('คำสั่งซื้อสำเร็จ!', 'คำสั่งซื้อของคุณได้รับการยืนยันแล้ว! ทางร้านจะติดต่อกลับโดยเร็วที่สุด');
            cart = []; // Clear cart after successful order
            updateCartDisplay(); // Update cart count to 0
            toggleCheckoutModal(); // Close checkout modal
            form.reset(); // Reset the form
            // togglePaymentDetails(); // No longer needed as there's no dynamic display
        } else {
            showAlertDialog('ข้อผิดพลาด', `เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ: ${result.message || 'ไม่ทราบข้อผิดพลาด'}`);
            console.error('Apps Script Error:', result.message);
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        showAlertDialog('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อ โปรดตรวจสอบอินเทอร์เน็ตของคุณและลองอีกครั้ง');
    }
}

// --- Product Detail Modal Functions ---

/**
 * Shows the product detail modal with the given product information.
 * @param {object} product - The product object to display.
 */
function showProductDetail(product) {
    // Show toast notification when product is selected
    showToast('เลือกสินค้าแล้ว', 'success');
    
    const detailModal = document.getElementById('productDetailModal');
    const detailImage = document.getElementById('detailProductImage');
    const detailName = document.getElementById('detailProductName');
    const detailDescription = document.getElementById('detailProductDescription');
    const detailVariants = document.getElementById('detailProductVariants');
    const detailPrice = document.getElementById('detailProductPrice');
    const detailAddToCartButton = document.getElementById('detailAddToCartButton');

    detailImage.src = product.img;
    detailName.innerText = product.baseName;
    detailDescription.innerText = product.description || "ไม่มีรายละเอียดเพิ่มเติมสำหรับสินค้านี้";

    // Render variants for product detail page
    detailVariants.innerHTML = '';
    if (product.variants && product.variants.length > 0) {
        if (product.variants.length > 1) {
            const selectElement = document.createElement('select');
            selectElement.id = 'detailVariantSelect';
            selectElement.className = 'w-full p-2 rounded border dark-mode-bg-gray-800 dark-mode-text-white dark-mode-border-gray-700 light-mode-bg-gray-100 light-mode-text-gray-800 light-mode-border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500';
            product.variants.forEach(variant => {
                const option = document.createElement('option');
                option.value = `${variant.type}|${variant.price}`;
                option.innerText = `${variant.type} (${variant.price} บาท)`;
                selectElement.appendChild(option);
            });
            detailVariants.appendChild(selectElement);
            // Update price display when variant changes
            selectElement.onchange = () => {
                const [type, price] = selectElement.value.split('|');
                detailPrice.innerText = `ราคา: ${parseFloat(price).toLocaleString()} บาท`;
            };
            // Set initial price display
            const [initialType, initialPrice] = selectElement.value.split('|');
            detailPrice.innerText = `ราคา: ${parseFloat(initialPrice).toLocaleString()} บาท`;

        } else {
            // Single variant
            const variant = product.variants[0];
            detailVariants.innerHTML = `<p class="dark-mode-text-gray-300 light-mode-text-gray-700">ชนิด: ${variant.type !== "Original" ? variant.type : 'มาตรฐาน'}</p>`;
            detailPrice.innerText = `ราคา: ${variant.price.toLocaleString()} บาท`;
        }
    } else {
        detailVariants.innerHTML = `<p class="dark-mode-text-gray-300 light-mode-text-gray-700">ไม่มีชนิดให้เลือก</p>`;
        detailPrice.innerText = `ราคา: N/A`;
    }

    // Update Add to Cart button based on stock
    if (product.inStock) {
        detailAddToCartButton.disabled = false;
        detailAddToCartButton.classList.remove('bg-gray-500', 'cursor-not-allowed');
        detailAddToCartButton.classList.add('btn-primary');
        // Set onclick for the button in the detail modal
        detailAddToCartButton.onclick = () => {
            let selectedType = '';
            let selectedPrice = 0;
            if (product.variants.length > 1) {
                const selectElement = document.getElementById('detailVariantSelect');
                const [type, price] = selectElement.value.split('|');
                selectedType = type;
                selectedPrice = parseFloat(price);
            } else if (product.variants.length === 1) {
                selectedType = product.variants[0].type;
                selectedPrice = product.variants[0].price;
            }
            const fullProductName = `${product.baseName} (${selectedType !== "Original" ? selectedType : 'มาตรฐาน'})`;
            addToCartFromDetail(product.baseName, selectedType, selectedPrice, fullProductName);
        };
        detailAddToCartButton.innerText = 'เพิ่มลงตะกร้า';
    } else {
        detailAddToCartButton.disabled = true;
        detailAddToCartButton.classList.remove('btn-primary');
        detailAddToCartButton.classList.add('bg-gray-500', 'cursor-not-allowed');
        detailAddToCartButton.innerText = 'สินค้าหมด';
    }

    detailModal.classList.remove('hidden');
    detailModal.classList.add('flex');
}

/**
 * Closes the product detail modal.
 */
function toggleProductDetailModal() {
    const detailModal = document.getElementById('productDetailModal');
    detailModal.classList.add('hidden');
    detailModal.classList.remove('flex');
}

/**
 * Adds a product (with selected variant) from the detail page to the cart.
 * @param {string} baseName - The base name of the product.
 * @param {string} variantType - The selected variant type.
 * @param {number} price - The price of the selected variant.
 * @param {string} fullProductName - The full product name including variant.
 */
function addToCartFromDetail(baseName, variantType, price, fullProductName) {
    const existingItem = cart.find(item => item.fullProductName === fullProductName);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            baseName: baseName,
            variantType: variantType,
            price: price,
            fullProductName: fullProductName,
            quantity: 1
        });
    }
    updateCartDisplay();
    showToast(`🛒 "${fullProductName}" ถูกเพิ่มในตะกร้าแล้ว!`);
    toggleProductDetailModal(); // Close detail modal after adding to cart
}


// --- Admin Panel Functions ---

/**
 * Toggles the visibility of the admin login modal.
 */
function toggleAdminLoginModal() {
    const adminLoginModal = document.getElementById('adminLoginModal');
    if (adminLoginModal.classList.contains('hidden')) {
        adminLoginModal.classList.remove('hidden');
        adminLoginModal.classList.add('flex');
        document.getElementById('adminPassword').value = ''; // Clear password field
    } else {
        adminLoginModal.classList.add('hidden');
        adminLoginModal.classList.remove('flex');
    }
}

/**
 * Shows the admin login modal.
 */
function showAdminLogin() {
    toggleAdminLoginModal();
}

/**
 * Handles admin login authentication.
 */
function adminLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const now = Date.now();
    if (adminLoginBlockedUntil && now < adminLoginBlockedUntil) {
        // เพิ่มเวลา block อีก 30 วินาทีทุกครั้งที่พยายาม login ขณะถูกบล็อก
        adminLoginBlockedUntil = now + ADMIN_LOGIN_BLOCK_TIME;
        showAlertDialog('ถูกบล็อก', `คุณกรอกรหัสผิดเกินจำนวนครั้งที่กำหนด กรุณารอ ${(Math.ceil((adminLoginBlockedUntil-now)/1000))} วินาที`);
        passwordInput.value = '';
        return;
    }
    if (passwordInput.value === ADMIN_PASSWORD) {
        adminLoginAttempts = 0;
        adminLoginBlockedUntil = 0;
        toggleAdminLoginModal(); // Close login modal
        toggleAdminPanelModal(); // Open admin panel
        renderAdminProducts(); // Load products in admin panel
    } else {
        adminLoginAttempts++;
        if (adminLoginAttempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
            adminLoginBlockedUntil = now + ADMIN_LOGIN_BLOCK_TIME;
            showAlertDialog('ถูกบล็อก', `คุณกรอกรหัสผิดเกินจำนวนครั้งที่กำหนด กรุณารอ 30 วินาที`);
        } else {
            showAlertDialog('เข้าสู่ระบบล้มเหลว', 'รหัสผ่านไม่ถูกต้อง');
        }
        passwordInput.value = '';
    }
}

/**
 * Toggles the visibility of the admin panel modal.
 */
function toggleAdminPanelModal() {
    const adminPanelModal = document.getElementById('adminPanelModal');
    if (adminPanelModal.classList.contains('hidden')) {
        adminPanelModal.classList.remove('hidden');
        adminPanelModal.classList.add('flex');
        renderAdminProductListByCategory();
        setTimeout(() => {
            const ta = document.getElementById('bulkProductTextarea');
            if (ta) { ta.disabled = false; ta.focus(); }
        }, 200);
    } else {
        adminPanelModal.classList.add('hidden');
        adminPanelModal.classList.remove('flex');
        renderProducts();
    }
}
// แสดงสินค้าในแผงควบคุมผู้ดูแลแบบแยกหมวดหมู่
function renderAdminProductListByCategory() {
    const container = document.getElementById('adminProductListByCategory');
    container.innerHTML = '';
    const cats = Object.keys(products);
    if (!cats.length) {
        container.innerHTML = '<p class="text-gray-600 text-center py-4">ยังไม่มีสินค้าในระบบ</p>';
        return;
    }
    cats.forEach(cat => {
        if (!products[cat] || !products[cat].length) return;
        const catDiv = document.createElement('div');
        catDiv.className = 'mb-4';
        catDiv.innerHTML = `<h4 class='text-lg font-bold mb-2 text-blue-700'>${cat}</h4>`;
        products[cat].forEach((prod, idx) => {
            const item = document.createElement('div');
            item.className = 'p-2 border rounded mb-2 bg-white text-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between';
            const isOutOfStock = prod.status === 'ของหมด' || prod.status === '❌ ของหมด';
            item.innerHTML = `
                <div>
                    <b>${prod.baseName}</b>
                    <span class='text-sm text-gray-500 ml-2'>${prod.variants && prod.variants.length ? prod.variants.map(v => v.type + (v.price ? ' ' + v.price + '฿' : '')).join(', ') : ''}</span>
                </div>
                <div class='flex gap-2 mt-2 sm:mt-0'>
                    <button onclick="toggleProductOutOfStock('${cat}',${idx})" class="${isOutOfStock ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white px-2 py-1 rounded text-xs font-semibold transition">
                        ${isOutOfStock ? 'แจ้งมีสินค้า' : 'แจ้งสินค้าหมด'}
                    </button>
                    <button onclick="showEditProductModal('${cat}',${idx})" class="btn-info px-2 py-1 rounded text-xs">แก้ไข</button>
                    <button onclick="deleteProduct('${cat}',${idx})" class="btn-danger px-2 py-1 rounded text-xs">ลบ</button>
                </div>
            `;
            catDiv.appendChild(item);
        });
        container.appendChild(catDiv);
    });
}

/**
 * Renders the list of products in the admin panel for editing.
 */
function renderAdminProducts() {
    const adminProductListDiv = document.getElementById('adminProductList');
    adminProductListDiv.innerHTML = ''; // Clear existing list

    // Flatten products into a single array for easier iteration
    let allProducts = [];
    for (const category in products) {
        products[category].forEach((p, idx) => {
            allProducts.push({ ...p, category: category, originalIndex: idx });
        });
    }

    if (allProducts.length === 0) {
        adminProductListDiv.innerHTML = '<p class="text-gray-600 text-center py-4">ยังไม่มีสินค้าในระบบ</p>';
        return;
    }

    allProducts.forEach((product, globalIndex) => {
        const productItem = document.createElement('div');
        productItem.className = 'p-3 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border dark-mode-bg-gray-800 dark-mode-border-gray-700 light-mode-bg-gray-100 light-mode-border-gray-200';
        productItem.innerHTML = `
            <div class="flex-1">
                <p class="text-lg font-semibold dark-mode-text-gray-100 light-mode-text-gray-900">${product.baseName}</p>
                <p class="text-sm dark-mode-text-gray-400 light-mode-text-gray-600">หมวดหมู่: ${product.category}</p>
                <p class="text-sm dark-mode-text-gray-400 light-mode-text-gray-600">สถานะ: <span class="${product.inStock ? 'text-green-400' : 'text-red-400'} font-bold">${product.inStock ? 'มีในสต็อก' : 'สินค้าหมด'}</span></p>
            </div>
            <div class="flex flex-wrap gap-2 mt-3 sm:mt-0">
                <button onclick="toggleProductStock('${product.category}', ${product.originalIndex})" class="btn-warning px-3 py-1 rounded-lg text-sm">
                    ${product.inStock ? 'แจ้งสินค้าหมด' : 'แจ้งมีสินค้า'}
                </button>
                <button onclick="showEditProductModal('${product.category}', ${product.originalIndex})" class="btn-info px-3 py-1 rounded-lg text-sm">
                    แก้ไข
                </button>
                <button onclick="deleteProduct('${product.category}', ${product.originalIndex})" class="btn-danger px-3 py-1 rounded-lg text-sm">
                    ลบ
                </button>
            </div>
        `;
        adminProductListDiv.appendChild(productItem);
    });
}

/**
 * Toggles the inStock status of a product.
 * @param {string} categoryName - The category of the product.
 * @param {number} productIndex - The index of the product within its category.
 */
function toggleProductStock(categoryName, productIndex) {
    if (products[categoryName] && products[categoryName][productIndex]) {
        products[categoryName][productIndex].inStock = !products[categoryName][productIndex].inStock;
        renderAdminProducts(); // Re-render admin list
        renderProducts(); // Re-render main shop page
        showToast(`สถานะสินค้า "${products[categoryName][productIndex].baseName}" ถูกอัปเดตแล้ว`);
    }
}

/**
 * Shows the edit product modal, populating it with product data or for a new product.
 * @param {string} categoryName - The category of the product (or 'new' for a new product).
 * @param {number} [productIndex] - The index of the product within its category (optional for new product).
 */
function showEditProductModal(categoryName, productIndex) {
    const editProductModal = document.getElementById('editProductModal');
    const editProductModalTitle = document.getElementById('editProductModalTitle');
    const editProductForm = document.getElementById('editProductForm');
    const editVariantsContainer = document.getElementById('editVariantsContainer');
    const editCategorySelect = document.getElementById('editCategory');
    const editDescriptionInput = document.getElementById('editDescription'); // Get description input

    // Clear previous variant fields
    editVariantsContainer.innerHTML = '';
    editProductForm.reset(); // Reset form fields

    // Populate category dropdown
    editCategorySelect.innerHTML = '';
    for (const cat in products) {
        const option = document.createElement('option');
        option.value = cat;
        option.innerText = cat;
        editCategorySelect.appendChild(option);
    }

    document.getElementById('editProductCategory').value = categoryName;
    document.getElementById('editProductIndex').value = productIndex !== undefined ? productIndex : '';

    if (categoryName === 'new') {
        editProductModalTitle.innerText = 'เพิ่มสินค้าใหม่';
        document.getElementById('editBaseName').value = '';
        document.getElementById('editImgUrl').value = '';
        editDescriptionInput.value = ''; // Clear description for new product
        document.getElementById('editInStock').checked = true; // New products are in stock by default
        addVariantField(); // Add one default variant field
    } else {
        editProductModalTitle.innerText = 'แก้ไขสินค้า';
        const product = products[categoryName][productIndex];
        document.getElementById('editBaseName').value = product.baseName;
        document.getElementById('editImgUrl').value = product.img;
        editDescriptionInput.value = product.description || ''; // Populate description
        document.getElementById('editInStock').checked = product.inStock;
        editCategorySelect.value = categoryName; // Set selected category

        // Populate existing variants
        product.variants.forEach(variant => {
            addVariantField(variant.type, variant.price);
        });
        if (product.variants.length === 0) { // Ensure at least one variant field if none exist
            addVariantField();
        }
    }

    editProductModal.classList.remove('hidden');
    editProductModal.classList.add('flex');
}

/**
 * Adds a new variant input field to the edit product form.
 * @param {string} [type=''] - Initial value for variant type.
 * @param {number} [price=''] - Initial value for variant price.
 */
function addVariantField(type = '', price = '') {
    const container = document.getElementById('editVariantsContainer');
    const variantDiv = document.createElement('div');
    variantDiv.className = 'flex flex-col sm:flex-row gap-2 items-center p-2 rounded border dark-mode-bg-gray-900 dark-mode-border-gray-700 light-mode-bg-gray-200 light-mode-border-gray-300';
    variantDiv.innerHTML = `
        <input type="text" placeholder="ชนิด (เช่น แดง, 2 เม็ด)" value="${type}" class="variant-type flex-1 p-2 rounded dark-mode-text-white dark-mode-bg-gray-700 light-mode-text-gray-800 light-mode-bg-white focus:outline-none focus:ring-1 focus:ring-red-500">
        <input type="number" placeholder="ราคา" value="${price}" class="variant-price w-24 p-2 rounded dark-mode-text-white dark-mode-bg-gray-700 light-mode-text-gray-800 light-mode-bg-white focus:outline-none focus:ring-1 focus:ring-red-500">
        <button type="button" onclick="this.parentNode.remove()" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-full text-sm">X</button>
    `;
    container.appendChild(variantDiv);
}

/**
 * Saves product changes (add new or update existing).
 */
function saveProduct() {
    const categoryName = document.getElementById('editProductCategory').value;
    const productIndex = document.getElementById('editProductIndex').value;
    const newBaseName = document.getElementById('editBaseName').value.trim();
    const newImgUrl = document.getElementById('editImgUrl').value.trim();
    const newDescription = document.getElementById('editDescription').value.trim(); // Get new description
    const newInStock = document.getElementById('editInStock').checked;
    const targetCategory = document.getElementById('editCategory').value;

    const variantTypeInputs = document.querySelectorAll('#editVariantsContainer .variant-type');
    const variantPriceInputs = document.querySelectorAll('#editVariantsContainer .variant-price');

    const newVariants = [];
    for (let i = 0; i < variantTypeInputs.length; i++) {
        const type = variantTypeInputs[i].value.trim();
        const price = parseFloat(variantPriceInputs[i].value);
        if (type && !isNaN(price)) {
            newVariants.push({ type, price });
        }
    }

    if (!newBaseName || newVariants.length === 0) {
        showAlertDialog('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อสินค้าและอย่างน้อยหนึ่งชนิดสินค้าพร้อมราคา');
        return;
    }

    const newProductData = {
        baseName: newBaseName,
        img: newImgUrl || 'https://placehold.co/200x150/333333/FFFFFF?text=No+Image',
        inStock: newInStock,
        variants: newVariants,
        description: newDescription // Use the new description from the input
    };

    if (productIndex === '') { // Adding new product
        if (!products[targetCategory]) {
            products[targetCategory] = []; // Create category if it doesn't exist
        }
        products[targetCategory].push(newProductData);
        showToast(`เพิ่มสินค้า "${newBaseName}" สำเร็จ`);
    } else { // Updating existing product
        // If category changed, remove from old and add to new
        if (categoryName !== targetCategory) {
            products[categoryName].splice(productIndex, 1); // Remove from old category
            if (!products[targetCategory]) {
                products[targetCategory] = [];
            }
            products[targetCategory].push(newProductData); // Add to new category
        } else {
            // Update in place if category is the same
            products[categoryName][productIndex] = newProductData;
        }
        showToast(`แก้ไขสินค้า "${newBaseName}" สำเร็จ`);
    }

    toggleEditProductModal(); // Close edit modal
    renderAdminProducts(); // Re-render admin list
    renderProducts(); // Re-render main shop page
    renderCategoryTabs(); // Re-render category tabs in case a new category was added
    renderMainCategoryGrid(); // Re-render main category grid if categories changed
    renderAISuggestions(); // Re-render AI suggestions
}

/**
 * Deletes a product.
 * @param {string} categoryName - The category of the product.
 * @param {number} productIndex - The index of the product within its category.
 */
function deleteProduct(categoryName, productIndex) {
    // Using custom alert for confirmation
    showAlertDialog('ยืนยันการลบ', `คุณแน่ใจหรือไม่ที่จะลบสินค้า "${products[categoryName][productIndex].baseName}"?`, () => {
        products[categoryName].splice(productIndex, 1);
        renderAdminProducts(); // Re-render admin list
        renderProducts(); // Re-render main shop page
        showToast('ลบสินค้าสำเร็จ');
        closeAlertDialog(); // Close the alert after action
    }, true); // Pass true to indicate it's a confirmation with a callback
}

/**
 * Toggles the visibility of the edit product modal.
 */
function toggleEditProductModal() {
    const editProductModal = document.getElementById('editProductModal');
    if (editProductModal.classList.contains('hidden')) {
        editProductModal.classList.remove('hidden');
        editProductModal.classList.add('flex');
    } else {
        editProductModal.classList.add('hidden');
        editProductModal.classList.remove('flex');
    }
}

/**
 * Renders AI-powered product suggestions.
 * For demonstration, this picks random products. In a real app, this would be dynamic.
 */
function renderAISuggestions() {
    const aiSuggestionsGrid = document.getElementById('aiSuggestionsGrid');
    aiSuggestionsGrid.innerHTML = ''; // Clear existing suggestions

    const allProducts = [];
    for (const category in products) {
        products[category].forEach(p => allProducts.push({ ...p, category: category }));
    }

    // Shuffle products and pick a few (e.g., 4-8)
    const shuffledProducts = allProducts.sort(() => 0.5 - Math.random());
    const suggestions = shuffledProducts.slice(0, Math.min(shuffledProducts.length, 8)); // Max 8 suggestions

    if (suggestions.length === 0) {
        aiSuggestionsGrid.innerHTML = '<p class="text-gray-600 text-center py-4 col-span-full">ไม่มีสินค้าแนะนำในขณะนี้</p>';
        return;
    }

    suggestions.forEach(product => {
        const suggestionCard = document.createElement('div');
        suggestionCard.className = 'ai-suggestion-card p-4 text-center cursor-pointer';
        if (product.inStock) {
            suggestionCard.onclick = () => showProductDetail(product);
        } else {
            suggestionCard.classList.add('out-of-stock');
        }

        let variantInfo = '';
        if (product.variants && product.variants.length > 0) {
            // Display info for the first variant or "หลายชนิด"
            if (product.variants.length === 1) {
                variantInfo = `<p class="text-sm dark-mode-text-gray-400 light-mode-text-gray-600">${product.variants[0].type !== "Original" ? product.variants[0].type : ''}</p>`;
            } else {
                variantInfo = `<p class="text-sm dark-mode-text-gray-400 light-mode-text-gray-600">หลายชนิด</p>`;
            }
        }

        suggestionCard.innerHTML = `
            <img src="${product.img}" alt="${product.baseName}" class="w-full h-32 object-cover rounded mb-3" onerror="this.onerror=null;this.src='https://placehold.co/200x150/333333/FFFFFF?text=No+Image';" />
            <h4 class="text-lg font-semibold mb-1">${product.baseName}</h4>
            ${variantInfo}
            <p class="text-xl font-bold text-green-500">${product.variants[0]?.price.toLocaleString() || 'N/A'} บาท</p>
            ${product.inStock ? `
                <button onclick="event.stopPropagation(); showProductDetail(product)" class="mt-3 w-full btn-primary py-2 rounded text-sm">ดูสินค้า</button>
            ` : `
                <div class="out-of-stock-overlay">
                    <span class="pulse-text">สินค้าหมด</span>
                </div>
                <button disabled class="mt-3 w-full bg-gray-500 text-white py-2 rounded cursor-not-allowed text-sm">สินค้าหมด</button>
            `}
        `;
        aiSuggestionsGrid.appendChild(suggestionCard);
    });
}


// Event listener to ensure DOM is fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
    // Initialize theme based on local storage or default to dark
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.add(savedTheme + '-mode');
    } else {
        document.body.classList.add('dark-mode'); // Default to dark mode
    }
    updateThemeSpecificStyles(); // Apply initial theme styles

    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    renderMainCategoryGrid(); // Render main category grid
    renderCategoryTabs(); // Render product categories
    selectCategory('ทั้งหมด'); // Select "All" category by default
    updateCartDisplay(); // Initialize cart display
    // togglePaymentDetails(); // This call is no longer needed as there's no dynamic display for bank details
    initializeIntersectionObserver(); // Initialize Intersection Observer for animations
    renderAISuggestions(); // Render AI suggestions on load
});

// --- Bulk Product Parsing for Admin ---
function handleBulkProductParse() {
    const textarea = document.getElementById('bulkProductTextarea');
    const previewDiv = document.getElementById('bulkProductPreview');
    const text = textarea.value.trim();
    if (!text) {
        previewDiv.innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
        return;
    }
    const parsed = parseBulkProductText(text);
    if (!parsed.length) {
        previewDiv.innerHTML = '<span class="text-red-500">ไม่สามารถแปลงข้อความได้</span>';
        return;
    }
    // Show preview only (do not fill modal form)
    previewDiv.innerHTML = '<b>Preview:</b><br>' + parsed.map(p =>
        `${p.baseName} (${p.variants.map(v => v.type + (v.price ? ' ' + v.price : '')).join(', ')})` + (p.note ? ' <span class="text-yellow-500">['+p.note+']</span>' : '')
    ).join('<br>');
}

// Clear textarea and preview in admin panel bulk input
function clearBulkProductTextarea() {
    document.getElementById('bulkProductTextarea').value = '';
    document.getElementById('bulkProductPreview').innerHTML = '';
}

// Add all parsed products to the products object (default to 'สายร้อน' category, can adjust as needed)
function addAllBulkProducts() {
    try {
        const textarea = document.getElementById('bulkProductTextarea');
        const previewDiv = document.getElementById('bulkProductPreview');
        let text = textarea.value.trim();
        // ถ้า textarea ว่าง ให้ prompt ให้ผู้ใช้วางข้อความ
        if (!text) {
            text = prompt('วางข้อความสินค้าทั้งหมดที่นี่ แล้วกดตกลงเพื่อเพิ่มสินค้าอัตโนมัติ:');
            if (!text) {
                previewDiv.innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
                return;
            }
            textarea.value = text;
        }
        console.log('[DEBUG] addAllBulkProducts called, textarea:', textarea, 'text:', text);
        // แยกหมวดหมู่จากข้อความ bulk (รองรับ สายร้อน, สายเม็ดบีบ, สายหวาน, ฯลฯ)
        let currentCategory = 'สายร้อน';
        let addedCount = 0;
        const lines = text.split(/\n|\r/).map(l => l.trim());
        lines.forEach(line => {
            if (/สายร้อน|สายเย็น|สายหวาน|ช็อกโกแลต|สายเม็ดบีบ|ผลไม้/i.test(line)) {
                if (/สายร้อน|สายเย็น/i.test(line)) currentCategory = 'สายร้อน';
                else if (/สายเม็ดบีบ|ผลไม้/i.test(line)) currentCategory = 'สายเม็ดบีบ / สายผลไม้';
                else if (/สายหวาน|ช็อกโกแลต/i.test(line)) currentCategory = 'สายหวาน / สายช็อกโกแลต';
            }
            // ข้ามบรรทัดหัวข้อ/หมายเหตุ
            if (/^\s*ตัวอย่าง|^\s*ช่วยกันดูราคา|^\s*ถ้าใส่ราคา|^\s*ให้ตาม|^\s*\d+\s*\.|^\s*$/i.test(line)) return;
            // เฉพาะบรรทัดที่มีสินค้า
            if (/^[✅-]/.test(line) || /[A-Za-zก-๙]/.test(line)) {
                const parsed = parseBulkProductText(line);
                if (parsed.length) {
                    if (!products[currentCategory]) products[currentCategory] = [];
                    parsed.forEach(p => {
                        products[currentCategory].push({
                            baseName: p.baseName,
                            img: '',
                            inStock: true,
                            variants: p.variants,
                            description: p.note || ''
                        });
                        addedCount++;
                    });
                }
            }
        });
        previewDiv.innerHTML += '<br><span class="text-green-500">เพิ่มสินค้า ' + addedCount + ' รายการเรียบร้อย!</span>';
        renderAdminProducts && renderAdminProducts();
        renderProducts && renderProducts();
    } catch (e) {
        alert('เกิดข้อผิดพลาด: ' + e.message);
        console.error('[ERROR] addAllBulkProducts', e);
    }
}

// For modal textarea (id: bulkProductTextareaModal)
function handleBulkProductParseModal() {
    const textarea = document.getElementById('bulkProductTextareaModal');
    const previewDiv = document.getElementById('bulkProductPreviewModal');
    const text = textarea.value.trim();
    if (!text) {
        previewDiv.innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
        return;
    }
    const parsed = parseBulkProductText(text);
    if (!parsed.length) {
        previewDiv.innerHTML = '<span class="text-red-500">ไม่สามารถแปลงข้อความได้</span>';
        return;
    }
    // Show preview
    previewDiv.innerHTML = '<b>Preview:</b><br>' + parsed.map(p =>
        `${p.baseName} (${p.variants.map(v => v.type + (v.price ? ' ' + v.price : '')).join(', ')})` + (p.note ? ' <span class="text-yellow-500">['+p.note+']</span>' : '')
    ).join('<br>');
    // Fill first product to form (baseName, variants, description)
    const p = parsed[0];
    document.getElementById('editBaseName').value = p.baseName || '';
    document.getElementById('editDescription').value = p.note || '';
    // Clear and fill variants
    const container = document.getElementById('editVariantsContainer');
    container.innerHTML = '';
    p.variants.forEach(variant => {
        const div = document.createElement('div');
        div.className = 'flex gap-2';
        div.innerHTML = `<input type="text" class="variant-type w-1/2" value="${variant.type}" placeholder="ชนิด">
            <input type="number" class="variant-price w-1/2" value="${variant.price || ''}" placeholder="ราคา">`;
        container.appendChild(div);
    });
}

// Robust parser for bulk product text (supports many Thai/real-world formats)
function parseBulkProductText(text) {
    // Split by line, filter empty
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const products = [];
    let current = null;
    lines.forEach(line => {
        // Match: NAME (TYPE): PRICE, or NAME (TYPE) PRICE, or NAME: PRICE, or NAME TYPE PRICE, etc.
        let m = line.match(/^([\w\u0E00-\u0E7F\s\-\.\/]+?)(?:\s*\(([^\)]+)\))?(?:\s*[:：])?\s*([\d,]+)?\s*(?:บาท|฿)?\s*(❌|📌|ของเข้าแล้ว|มี\s*\d+\s*แถว|\(.*?\)|[\u0E00-\u0E7F\w\s\-\/\.,]*)?$/);
        if (m) {
            let baseName = (m[1]||'').replace(/\s+$/,'').trim();
            let type = m[2] ? m[2].trim() : '';
            let price = m[3] ? parseInt(m[3].replace(/,/g, '')) : '';
            let note = (m[4]||'').trim();
            // Extract type from note if not found
            if (!type && note) {
                let t2 = note.match(/(\d+\s*มวน|\d+\s*แถว|\d+\s*คอต|เม็ดบีบ|สลิม|แข็ง|อ่อน|พรีเมียม|GUM MINT|GOLD|BLACK|BLUE|SLIM|SOFT|HARD|ฟิวชั่น|FUSION|DOUBLE|COOL|PERFECT|ORIGINAL|PLATINUM|GUM|MINT|เมนทอล|ผลไม้|ซองอ่อน|ซองแข็ง|เกรด\s*[AB]|รุ่นพิเศษ|รุ่นใหม่|รุ่นเก่า|[A-Z0-9]{2,})/i);
                if (t2) type = t2[0];
            }
            // Extract price from note if not found
            if (!price && note) {
                let p2 = note.match(/(\d{2,4})/);
                if (p2) price = parseInt(p2[1]);
            }
            // Clean up note
            note = note.replace(/❌|📌|ของเข้าแล้ว|\d+\s*แถว|\d+\s*คอต|\d+\s*มวน|รับได้.*|ต้องขาย.*|\(.*?\)/g, '').trim();
            // Support multiple types in one line: (แดง/เขียว)
            let types = type ? type.split(/[\/|,]/).map(t => t.trim()).filter(Boolean) : [''];
            let variants = types.map(t => ({ type: t, price }));
            // ดึงสถานะจาก line
            let status = '';
            if (/❌/.test(line)) status = 'ของหมด';
            else if (/📌/.test(line)) status = 'จำกัดออเดอร์';
            else if (/ของเข้าแล้ว/.test(line)) status = 'ของเข้าแล้ว';
            else status = 'มี';
            products.push({ baseName, variants, note, status });
            current = null;
        } else if (current) {
            // If line is a continuation (e.g. note)
            current.note = (current.note ? current.note + ' ' : '') + line;
        }
    });
    return products;

}

// ===== Bulk Add Modal Logic =====
function openBulkAddModal() {
    document.getElementById('bulkAddModal').classList.remove('hidden');
    document.getElementById('bulkAddTextarea').value = '';
    document.getElementById('bulkAddPreview').innerHTML = '';
}

function closeBulkAddModal() {
    document.getElementById('bulkAddModal').classList.add('hidden');
}

function previewBulkAddProducts() {
    const text = document.getElementById('bulkAddTextarea').value.trim();
    if (!text) {
        document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
        return;
    }
    try {
        let parsed = parseBulkProductText(text);
        // เงื่อนไข: ไม่เอาสินค้าที่มี "❌" หรือ "ต้องขาย" หรือ "รับได้" หรือ "📌" หรือ "ของหมด" หรือ "หมด" หรือ "รับได้...คอต" หรือ "รับได้...แถว" หรือ "รับได้...มวน" หรือ "ไม่ได้เขียวอะไร" หรือ "ต้องขาย..." หรือ "ราคาขึ้น" หรือ "ผิดร้าน" หรือ "ไม่ส่ง" หรือ "ของหมด" หรือ "หมด" ใน note หรือชื่อ
        parsed = parsed.filter(p => {
            const s = (p.baseName + ' ' + (p.note||''));
            return !/❌|ต้องขาย|รับได้|📌|ของหมด|หมด|ไม่ได้เขียวอะไร|ราคาขึ้น|ผิดร้าน|ไม่ส่ง/i.test(s);
        });
        if (!parsed.length) {
            document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">ไม่พบสินค้าที่รับออเดอร์ได้</span>';
            return;
        }
        let html = '<div class="text-left">';
        parsed.forEach((p, i) => {
            html += `<div class='mb-1'>${i+1}. <b>${p.baseName}</b> <span class='text-green-600'>${p.variants.map(v=>v.type+(v.price?' '+v.price+'฿':'')).join(', ')}</span> <span class='text-blue-600'>${p.note||''}</span></div>`;
        });
        html += '</div>';
        document.getElementById('bulkAddPreview').innerHTML = html;
    } catch (e) {
        document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">เกิดข้อผิดพลาด: ' + e.message + '</span>';
    }
}

function confirmBulkAddProducts() {
    const text = document.getElementById('bulkAddTextarea').value.trim();
    if (!text) {
        document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">กรุณาวางข้อความสินค้า</span>';
        return;
    }
    let parsed;
    try {
        parsed = parseBulkProductText(text);
        // เงื่อนไข: ไม่เอาสินค้าที่มี "❌" หรือ "ต้องขาย" หรือ "รับได้" หรือ "📌" หรือ "ของหมด" หรือ "หมด" หรือ "รับได้...คอต" หรือ "รับได้...แถว" หรือ "รับได้...มวน" หรือ "ไม่ได้เขียวอะไร" หรือ "ต้องขาย..." หรือ "ราคาขึ้น" หรือ "ผิดร้าน" หรือ "ไม่ส่ง" หรือ "ของหมด" หรือ "หมด" ใน note หรือชื่อ
        parsed = parsed.filter(p => {
            const s = (p.baseName + ' ' + (p.note||''));
            return !/❌|ต้องขาย|รับได้|📌|ของหมด|หมด|ไม่ได้เขียวอะไร|ราคาขึ้น|ผิดร้าน|ไม่ส่ง/i.test(s);
        });
    } catch (e) {
        document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">เกิดข้อผิดพลาด: ' + e.message + '</span>';
        return;
    }
    if (!parsed.length) {
        document.getElementById('bulkAddPreview').innerHTML = '<span class="text-red-500">ไม่พบสินค้าที่รับออเดอร์ได้</span>';
        return;
    }
    // เพิ่มสินค้าเข้า products (หมวด "อื่นๆ")
    if (!products['อื่นๆ']) products['อื่นๆ'] = [];
    parsed.forEach(p => {
        products['อื่นๆ'].push({
            baseName: p.baseName,
            img: '',
            inStock: true,
            variants: p.variants,
            description: p.note || ''
        });
    });
    renderProducts();
    if (typeof renderAdminProductListByCategory === 'function') renderAdminProductListByCategory();
    closeBulkAddModal();
    showToast('เพิ่มสินค้าทั้งหมดเรียบร้อยแล้ว', 'success');
}

// เพิ่มฟังก์ชัน toggleProductOutOfStock สำหรับปุ่มแจ้งสินค้าหมดในแผงควบคุม พร้อม showToast แจ้งเตือนและ sync สถานะไปยัง cart/รายการสินค้า
function toggleProductOutOfStock(category, idx) {
    const prod = products[category][idx];
    if (prod.status === 'ของหมด' || prod.status === '❌ ของหมด') {
        prod.status = 'มี';
        // ถ้าสินค้ากลับมามี ให้ลบ flag สินค้าหมดใน cart
        if (Array.isArray(cart)) {
            cart.forEach(item => {
                if (item.baseName === prod.baseName && item.category === category) {
                    item.isOutOfStock = false;
                }
            });
            if (typeof updateCartDisplay === 'function') updateCartDisplay();
        }
        showToast(`สินค้า "${prod.baseName}" กลับมามีในสต็อกแล้ว`, 'success');
    } else {
        prod.status = 'ของหมด';
        // mark ว่าใน cart สินค้านี้หมด (ไม่ลบสินค้าออก)
        if (Array.isArray(cart)) {
            cart.forEach(item => {
                if (item.baseName === prod.baseName && item.category === category) {
                    item.isOutOfStock = true;
                }
            });
            if (typeof updateCartDisplay === 'function') updateCartDisplay();
        }
        showToast(`สินค้า "${prod.baseName}" ถูกแจ้งว่าสินค้าหมดแล้ว (จะแสดง \"สินค้าหมด\" ในหน้ารายการสินค้าและตะกร้า)`, 'warning');
    }
    renderAdminProductListByCategory();
    if (typeof renderProducts === 'function') renderProducts();
}