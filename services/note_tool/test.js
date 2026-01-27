import { createCard, deleteCard, getCardsByUser, updateCard } from "./note_tool_card.js";
import { createUser, getUserById } from "./note_tool_user.js";

// 測試建立使用者
// async function testCreateUser(){
//     try{
//         const newUser = await createUser({
//             id:'shao',
//             email:'test@gmail.com',
//             displayName:'Shao',
//             passwordHash:'shao1234'
//         });

//         console.log('註冊成功',newUser);
//     }catch(err){
//         console.log('測試失敗',err.message);
//     }
// }

// 測試取得使用者
//  testCreateUser()

// async function testGetUserById (){
//     try{
//         const user = await getUserById('shao');

//         console.log('取得使用者',user);
//     }catch(err){
//         console.log('測試失敗',err.message);
//     }
// }

// testGetUserById();

// 測試建立卡片
// async function testCreateCard(){
//     try{
//         const card = await createCard({
//             user_id:'shao',
//             title:'測試標題',
//             content:'測試內文'
//         });

//         console.log('卡片建立成功',card);
//     }catch(err){
//         console.log('卡片建立失敗',err.message);
//     }
// }

// testCreateCard()


async function testGetCardsByUser(){
    try{
        const cards = await getCardsByUser('shao');

        console.log('取得卡片成功',cards);
    }catch(err){
        console.log('取得卡片失敗',err.message);
    }
}

testGetCardsByUser();

// async function testUpdateCards(){
//     try{
//         const card = await updateCards({id:1,title:'測試換Title',content:'測試換內容'});

//         console.log('更新卡片成功',card);

//     }catch(err){
//         console.log('更新卡片失敗',err.message);
//     }
// }

// testUpdateCards()

// async function testDeleteCards(){
//     try{
//         const res = await deleteCard({id:1,user_id:'shao'})
//         console.log('刪除卡片成功',res);

//     }catch(err){
//         console.log('刪除卡片失敗',err.message);
//     }
// }

// testDeleteCards();