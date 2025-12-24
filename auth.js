// auth.js
module.exports = function (req, res, next) {
    // ログイン済みなら通す
    if (req.session && req.session.isLoggedIn) {
        return next();
    }
    // 未ログインならログイン画面へリダイレクト
    // ※APIへのアクセスの場合は401を返すべきですが、今回は簡易的に全部リダイレクトします
    return res.redirect('/login');
};