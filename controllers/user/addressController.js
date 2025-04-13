const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');

const addressAdd = async (req, res) => {
    try {
        const user = req.session.user;
        const addresses = await Address.find({ userId: user._id });
        
        res.render('Address', {
            user: user,
            addresses: addresses 
        });
    } catch (error) {
        console.error('Error loading address page:', error);
        res.redirect('/pageNotFound');
    }
};

const addNewAddress = async (req, res) => {
    console.log('Add new address request received');
    console.log('Request body:', req.body);
    console.log('Session user:', req.session.user);

    try {
        const user = req.session.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const {
            fullName,
            phone,
            address,
            city,
            state,
            country,
            pincode,
            addressType,
            isDefault
        } = req.body;

        const missingFields = [];
        if (!fullName) missingFields.push('Full Name');
        if (!phone) missingFields.push('Phone');
        if (!address) missingFields.push('Address');
        if (!city) missingFields.push('City');
        if (!state) missingFields.push('State');
        if (!country) missingFields.push('Country');
        if (!pincode) missingFields.push('Pincode');
        if (!addressType) missingFields.push('Address Type');

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be exactly 10 digits'
            });
        }
        if (phone === '0000000000') {
            return res.status(400).json({
                success: false,
                message: 'Phone number cannot be all zeros'
            });
        }

        const pincodeRegex = /^\d{6}$/;
        if (!pincodeRegex.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Pincode must be exactly 6 digits'
            });
        }
        if (pincode === '000000') {
            return res.status(400).json({
                success: false,
                message: 'Pincode cannot be all zeros'
            });
        }

        if (isDefault === 'true' || isDefault === true) {
            await Address.updateMany(
                { userId: user._id, isDefault: true },
                { isDefault: false }
            );
        }

        const newAddress = new Address({
            userId: user._id,
            fullName,
            phone,
            address,
            city,
            state,
            country,
            pincode,
            addressType,
            isDefault: isDefault === 'true' || isDefault === true
        });

        await newAddress.save();

        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            address: newAddress
        });

    } catch (error) {
        console.error('Detailed error adding address:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

const getAllAddresses = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        const addresses = await Address.find({ userId: user._id });

        res.status(200).json({
            success: true,
            addresses: addresses
        });

    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

const getAddressById = async (req, res) => {
    console.log('Route hit: Fetching address');
    console.log('Received address ID:', req.params.id);
    
    try {
        const addressId = req.params.id;

        if (!addressId) {
            console.error('No address ID provided');
            return res.status(400).json({ 
                success: false, 
                message: 'Address ID is required' 
            });
        }

        const address = await Address.findById(addressId);
        
        console.log('Found address:', address);

        if (!address) {
            console.error('Address not found for ID:', addressId);
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }
        
        res.json({ 
            success: true, 
            address: address 
        });
    } catch (error) {
        console.error('Complete error in getAddressById:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching address details',
            error: error.message 
        });
    }
};

const updateAddress = async (req, res) => {
    try {
        console.log('Update address request received');
        console.log('Session user:', req.session.user);
        console.log('Request body:', req.body);
        console.log('Address ID:', req.params.id);

        const user = req.session.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const addressId = req.params.id;

        const {
            fullName,
            phone,
            address,
            city,
            state,
            country,
            pincode,
            addressType,
            isDefault
        } = req.body;

        const missingFields = [];
        if (!fullName) missingFields.push('Full Name');
        if (!phone) missingFields.push('Phone');
        if (!address) missingFields.push('Address');
        if (!city) missingFields.push('City');
        if (!state) missingFields.push('State');
        if (!country) missingFields.push('Country');
        if (!pincode) missingFields.push('Pincode');
        if (!addressType) missingFields.push('Address Type');

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be exactly 10 digits'
            });
        }
        if (phone === '0000000000') {
            return res.status(400).json({
                success: false,
                message: 'Phone number cannot be all zeros'
            });
        }

        const pincodeRegex = /^\d{6}$/;
        if (!pincodeRegex.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Pincode must be exactly 6 digits'
            });
        }
        if (pincode === '000000') {
            return res.status(400).json({
                success: false,
                message: 'Pincode cannot be all zeros'
            });
        }

        if (isDefault === 'true' || isDefault === true) {
            await Address.updateMany(
                { userId: user._id, isDefault: true },
                { isDefault: false }
            );
        }

        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, userId: user._id }, 
            {
                fullName,
                phone,
                address,
                city,
                state,
                country,
                pincode,
                addressType,
                isDefault: isDefault === 'true' || isDefault === true
            },
            { 
                new: true,
                runValidators: true
            }
        );

        if (!updatedAddress) {
            console.error('Address not found or user mismatch');
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found or unauthorized' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            address: updatedAddress
        });

    } catch (error) {
        console.error('Detailed error updating address:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            console.error('Delete address: User not authenticated');
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        const addressId = req.params.id;
        if (!addressId || !mongoose.isValidObjectId(addressId)) {
            console.error('Delete address: Invalid address ID:', addressId);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid address ID' 
            });
        }

        const deletedAddress = await Address.findOneAndDelete({ 
            _id: addressId, 
            userId: user._id 
        });

        if (!deletedAddress) {
            console.error('Delete address: Address not found for ID:', addressId, 'User:', user._id);
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found or you are not authorized to delete it' 
            });
        }

        if (deletedAddress.isDefault) {
            const nextAddress = await Address.findOne({ userId: user._id });
            if (nextAddress) {
                nextAddress.isDefault = true;
                await nextAddress.save();
                console.log('Delete address: Set new default address:', nextAddress._id);
            }
        }

        console.log('Delete address: Successfully deleted address:', addressId);
        res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        console.error('Delete address: Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error: ' + error.message
        });
    }
};

module.exports = {
    addressAdd,
    addNewAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
};