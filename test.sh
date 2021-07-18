node preprocess.js
a=`date '+%D'`
echo $a
git add .
git commit -m $a
git push