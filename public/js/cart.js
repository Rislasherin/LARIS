async function updateQuantity(productId, action) {
    try {
        const response = await fetch('/user/cart/update-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, action })
        });

        const data = await response.json();
        if (data.success) {
            const quantityInput = document.getElementById(`quantity-${productId}`);
            if (quantityInput) quantityInput.value = data.quantity;

            const itemTotalElement = document.querySelector(`#item-total-${productId}`);
            if (itemTotalElement) itemTotalElement.textContent = `₹${(data.productPrice * data.quantity).toFixed(2)}`;

            updateOrderSummary(data.subtotal, data.shippingCost, data.total);
        } else {
            alert(data.message || 'Could not update quantity');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
    }
}

function updateOrderSummary(subtotal, shippingCost, total) {
    const subtotalElement = document.querySelector('#subtotal-value');
    const shippingElement = document.querySelector('#shipping-value'); 
    const totalElement = document.querySelector('#total-value');

    if (subtotalElement) subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    if (shippingElement) shippingElement.textContent = `₹${shippingCost.toFixed(2)}`;
    if (totalElement) totalElement.textContent = `₹${total.toFixed(2)}`;
}





// Remove from cart (unchanged for now, but can be updated similarly)
async function removeFromCart(productId) {
    try {
        const response = await fetch('/user/cart/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId })
        });

        const data = await response.json();
        if (data.success) {
            window.location.reload(); // Can be made dynamic too
        } else {
            alert('Could not remove item');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
    }
}

// Placeholder for wishlist functionality
function moveToWishlist(productId) {
    alert('Wishlist functionality to be implemented');
}