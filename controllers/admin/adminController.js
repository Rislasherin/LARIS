const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const pageError = async (req, res) => {
    res.render('admin-error')
}


const loadLogin = (req, res) => {
    if(req.session.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render('admin-login',{message:null})
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email: email });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
               
                req.session.admin = true;
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/admin/login');
            }
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log("Login Error", error);
        return res.redirect('/pageerror');
    }
};



const logout = async (req, res) => {
    try {
        if (req.session.admin) {
             req.session.admin = false; 
        }
        res.redirect('/admin/login'); 
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/admin/pageerror');
    }
};






module.exports = {
    loadLogin,
    login,
    pageError,
    logout,
    

}