const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const knex = require('knex');
const Clarifai =  require('clarifai');

const db = knex({
    client: 'pg',
        connection: {
        host : process.env.DATABASE_URL,
        ssl: true,
    }
});

const app = express();

//MIDDLEWARE
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(cors());

const appClarifai = new Clarifai.App({
    apiKey: '02331e13105340eca326af7ac1b77079'
});

const getHash = (password) => {
    // To hash a password:
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
}

const autoHash = (password) => {
   // Auto-gen a salt and hash:
   const hash = bcrypt.hashSync(password, 8); 
   return hash;
}

const compareHash = (password, hash) => {
    // Load hash from your password DB.
    const resultCompare = bcrypt.compareSync(password, hash); // true or false
    return resultCompare;
}

app.get('/', (req,res) => {
    // console.log("this is working!");
    res.json("this is working!");
});

//SIGNIN METHOD
app.post('/signin', (req,res) => {
    console.log(req.body);
    const {email, password} = req.body;

    if(email && password) {

        db
        .select('email', 'hash')
        .from('login')
        .where('email','=', email)
        .then(user => {
            if(user.length){
                user = user[0];  
                const isValid = compareHash(password,user.hash);
                if(isValid){
                    return db
                    .select('*')
                    .from('users')
                    .where('email','=',email)
                    .then(user => {
                        if(user.length){
                            user = user[0];
                            res.json({hasError:false, message:"success", user: user});
                        }
                        else{
                            res.status(400).json({hasError:true, message:"Error getting user info."});
                        }
                    })
                    .catch(error => {
                        res.status(400).json({hasError:true, message:"Error getting user info."});
                    });
                    
                }
                else{
                    res.status(400).json({hasError:true, message:"Wrong credentials."});
                }
            }
            else{
                res.status(400).json({hasError:true, message:"Wrong credentials."});
            }
        })
        .catch(error => {
            res.status(400).json({hasError:true, message:"Error getting loging."});
        });

    }
    else{
        res.status(400).json({hasError:true, message:"User data incomplete."});
    }

});

//REGISTER METHOD
app.post('/register', (req,res) => {
    console.log(req.body);
    const {email, password, name} = req.body;
    if(!email || !password || !name) {
        return res.status(400).json({hasError:true, message:"User data incomplete."});
    }

        const hash = getHash(password);
        db.transaction(trx => {
            trx.insert({
                hash: hash,
                email: email
            })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                .insert({
                    email: loginEmail[0],
                    name: name,
                    joined: new Date()
                })
                .returning('*')
                .then(user => {
                    res.json({hasError:false, message:"success", user: user[0]});
                })
                .catch(error => {
                    res.status(400).json({hasError:true, message:'Unable to register.'});
                }); 
            })        
            .then(trx.commit)
            .catch(trx.rollback);
        });
});

//GET PROFILE METHOD
app.get('/profile/:id', (req,res) => {
    const {id} = req.params;
    db.select('*')
    .from('users')
    .where({id: id})
    .then(user => {
        console.log(user);
        if(user.length){
            user = user[0];
            res.json({hasError:false, message:"success", user: user});
        }
        else{
            res.status(400).json({hasError:true, message:"User not found."});
        }
    })
    .catch(error => {
        res.status(400).json({hasError:true, message:'Error getting user.'});
    });
});

//IMAGE => INCREASE THE NUMBER IMAGES CAPTURED 
app.put('/image', (req, res) => {
    const {id} = req.body;
    db('users')
    .where('id','=',id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
        if(entries){
            entries = entries[0];
            res.json({hasError: false, message: "success", entries: entries});
        }
        else{
            res.status(400).json({hasError: true, message: "Entries not found."});
        }
    })
    .catch(error => {
        res.status(400).json({hasError: true, message: "Unable to get entries."});
    });

});

//CLARIFAI APP KEY SECURE URL
app.post('/imageURL', (req, res) => {
    const {input} = req.body;
    console.log(input);
    appClarifai
    .models
    .predict(
        Clarifai.FACE_DETECT_MODEL,
        input
    ).then(data => {
        res.json({hasError: false, message: "success", data: data});
    }).catch(error => {
        res.status(400).json({hasError: true, message: "Error getting image info."});
    });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running in port: ${ PORT }.`);
});