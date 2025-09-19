// Cart Management Functions
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Function to update cart
function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

// Function to add item to cart
function addToCart(product, variant = null) {
    try {
        const productName = product.name;
        const price = variant ? variant.price : product.price;
        const variantType = variant ? variant.type : 'ทั่วไป';
        const fullProductName = `${productName} - ${variantType}`;

        // Check if item already exists in cart
        const existingItem = cart.find(item => 
            item.name === productName && 
            item.variant === variantType
        );

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                name: productName,
                price: parseFloat(price),
                quantity: 1,
                variant: variantType,
                fullProductName
            });
        }

        updateCart();
        showToast('เพิ่มสินค้าลงตะกร้าแล้ว', 'success');
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('เกิดข้อผิดพลาดในการเพิ่มสินค้า', 'error');
    }
}

// Function to update cart UI
function updateCartUI() {
    try {
        const cartItemCount = document.getElementById('cartItemCount');
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const formCartTotal = document.getElementById('formCartTotal');
        
        // Update item count badge
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartItemCount.textContent = totalItems;
        cartItemCount.classList.toggle('opacity-0', totalItems === 0);
        cartItemCount.classList.toggle('scale-0', totalItems === 0);

        // Update cart items list
        if (cartItems) {
            cartItems.innerHTML = cart.length === 0 ? 
                '<div class="p-4 text-center text-gray-500">ตะกร้าสินค้าว่างเปล่า</div>' :
                cart.map(item => `
                    <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
                        <div class="flex-1">
                            <h3 class="font-medium">${item.name}</h3>
                            <p class="text-sm text-gray-500">${item.variant}</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-2">
                                <button onclick="updateItemQuantity('${item.fullProductName}', -1)" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                                    </svg>
                                </button>
                                <span>${item.quantity}</span>
                                <button onclick="updateItemQuantity('${item.fullProductName}', 1)" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </button>
                            </div>
                            <div class="text-right">
                                <div class="font-medium">${(item.price * item.quantity).toLocaleString()} บาท</div>
                                <button onclick="removeFromCart('${item.fullProductName}')" class="text-sm text-red-500 hover:text-red-600">
                                    ลบ
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
        }

        // Update totals
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (cartTotal) cartTotal.textContent = `${total.toLocaleString()} บาท`;
        if (formCartTotal) formCartTotal.textContent = `${total.toLocaleString()} บาท`;

        // Enable/disable checkout button
        const checkoutButton = document.getElementById('checkoutButton');
        if (checkoutButton) {
            checkoutButton.disabled = cart.length === 0;
        }
    } catch (error) {
        console.error('Error updating cart UI:', error);
    }
}

// Function to update item quantity
function updateItemQuantity(fullProductName, change) {
    const index = cart.findIndex(item => item.fullProductName === fullProductName);
    if (index !== -1) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCart();
    }
}

// Function to remove item from cart
function removeFromCart(fullProductName) {
    const index = cart.findIndex(item => item.fullProductName === fullProductName);
    if (index !== -1) {
        cart.splice(index, 1);
        updateCart();
        showToast('ลบสินค้าออกจากตะกร้าแล้ว', 'info');
    }
}

// Function to clear cart
function clearCart() {
    cart = [];
    updateCart();
    showToast('ล้างตะกร้าสินค้าแล้ว', 'info');
}

// Function to show shipping form
function showShippingForm() {
    if (cart.length === 0) {
        showToast('กรุณาเพิ่มสินค้าในตะกร้าก่อนดำเนินการต่อ', 'warning');
        return;
    }
    
    document.getElementById('shippingForm').classList.remove('hidden');
    document.getElementById('cartFooter').classList.add('hidden');
    
    // Update form cart total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('formCartTotal').textContent = `${total.toLocaleString()} บาท`;
}

// Initialize cart UI on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
});

// Export functions
window.addToCart = addToCart;
window.updateItemQuantity = updateItemQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.showShippingForm = showShippingForm;