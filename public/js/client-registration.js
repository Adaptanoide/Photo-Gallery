// public/js/client-registration.js

class ClientRegistration {
    constructor() {
        this.form = document.getElementById('registrationForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.successMessage = document.getElementById('successMessage');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCharacterCounter();
        console.log('📝 Registration form initialized');
    }

    setupEventListeners() {
        // Form submit
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Business type "Other" toggle
        const businessType = document.getElementById('businessType');
        businessType.addEventListener('change', () => {
            const otherRow = document.querySelector('.other-business-row');
            if (businessType.value === 'other') {
                otherRow.style.display = 'block';
            } else {
                otherRow.style.display = 'none';
            }
        });

        // Resale Certificate toggle
        const noResaleCertificate = document.getElementById('noResaleCertificate');
        const resaleCertificateInput = document.getElementById('resaleCertificate');

        noResaleCertificate.addEventListener('change', () => {
            const reasonRow = document.querySelector('.no-certificate-reason');
            const reasonTextarea = document.getElementById('noCertificateReason');

            // Limpar erro do resale certificate quando checkbox mudar
            this.clearError(resaleCertificateInput);

            if (noResaleCertificate.checked) {
                reasonRow.style.display = 'block';
                resaleCertificateInput.disabled = true;
                resaleCertificateInput.value = '';
                resaleCertificateInput.style.opacity = '0.5';
                reasonTextarea.required = true;
            } else {
                reasonRow.style.display = 'none';
                resaleCertificateInput.disabled = false;
                resaleCertificateInput.style.opacity = '1';
                reasonTextarea.required = false;
                reasonTextarea.value = '';
            }
        });

        // Limpar erro do resale certificate quando digitar
        resaleCertificateInput.addEventListener('input', () => {
            if (resaleCertificateInput.value.trim()) {
                this.clearError(resaleCertificateInput);
            }
        });

        // Real-time validation on blur
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
    }

    setupCharacterCounter() {
        const textarea = document.getElementById('interestMessage');
        const counter = document.getElementById('charCount');

        textarea.addEventListener('input', () => {
            counter.textContent = textarea.value.length;
        });
    }

    validateField(input) {
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';

        if (input.required && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        if (input.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email';
            }
        }

        if (!isValid) {
            this.showError(input, errorMessage);
        } else {
            this.clearError(input);
        }

        return isValid;
    }

    showError(input, message) {
        const formGroup = input.closest('.form-group');
        formGroup.classList.add('error');

        const existingError = formGroup.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        formGroup.appendChild(errorDiv);
    }

    clearError(input) {
        const formGroup = input.closest('.form-group');
        formGroup.classList.remove('error');

        const existingError = formGroup.querySelector('.error-message');
        if (existingError) existingError.remove();
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        // Validação customizada: Resale Certificate OU checkbox
        if (!this.validateResaleCertificate()) {
            isValid = false;
        }

        return isValid;
    }

    validateResaleCertificate() {
        const resaleCertificate = document.getElementById('resaleCertificate');
        const noResaleCertificate = document.getElementById('noResaleCertificate');

        const hasCertificate = resaleCertificate.value.trim() !== '';
        const hasCheckedNo = noResaleCertificate.checked;

        if (!hasCertificate && !hasCheckedNo) {
            // Mostrar erro no campo do certificado
            this.showError(resaleCertificate, 'Please enter your certificate number or check the box below');
            return false;
        }

        this.clearError(resaleCertificate);
        return true;
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        const formData = {
            contactName: document.getElementById('contactName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            businessType: document.getElementById('businessType').value,
            businessTypeOther: document.getElementById('businessTypeOther').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
            country: document.getElementById('country').value,
            interestMessage: document.getElementById('interestMessage').value.trim(),
            howDidYouHear: document.getElementById('howDidYouHear').value,
            resaleCertificate: document.getElementById('resaleCertificate').value.trim(),
            hasResaleCertificate: !document.getElementById('noResaleCertificate').checked,
            noCertificateReason: document.getElementById('noCertificateReason').value.trim()
        };

        this.showLoading(true);
        this.submitBtn.disabled = true;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(formData.email);
            } else {
                this.showToast(data.message || 'Error submitting', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            this.showToast('Connection error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
            this.submitBtn.disabled = false;
        }
    }

    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showSuccess(email) {
        window.location.href = 'https://sunshinecowhides.com/pages/thank-you-for-contact-us-wholesale-request';
    }

    showToast(message, type = 'error') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ClientRegistration();
});